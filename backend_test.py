import requests
import websocket
import json
import threading
import time
import sys
from datetime import datetime

class VidChatProTester:
    def __init__(self, base_url="https://vidchatpro.preview.emergentagent.com"):
        self.base_url = base_url
        self.ws_url = base_url.replace('https://', 'wss://').replace('http://', 'ws://')
        self.tests_run = 0
        self.tests_passed = 0
        self.ws_connections = {}
        self.received_messages = {}

    def run_test(self, name, test_func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            result = test_func()
            if result:
                self.tests_passed += 1
                print(f"✅ Passed - {name}")
            else:
                print(f"❌ Failed - {name}")
            return result
        except Exception as e:
            print(f"❌ Failed - {name}: {str(e)}")
            return False

    def test_api_health(self):
        """Test basic API health"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            return response.status_code == 200 and "VidChat Pro API" in response.text
        except Exception as e:
            print(f"API health check failed: {e}")
            return False

    def test_messages_endpoint(self):
        """Test messages REST endpoint"""
        try:
            # Test getting messages between two users
            user1_id = "test_user_1"
            user2_id = "test_user_2"
            
            response = requests.get(f"{self.base_url}/api/messages/{user1_id}/{user2_id}", timeout=10)
            return response.status_code == 200 and isinstance(response.json(), list)
        except Exception as e:
            print(f"Messages endpoint test failed: {e}")
            return False

    def test_create_message(self):
        """Test creating a message via REST API"""
        try:
            message_data = {
                "from_user_id": "test_user_1",
                "from_username": "TestUser1",
                "to_user_id": "test_user_2",
                "message": "Test message from API"
            }
            
            response = requests.post(
                f"{self.base_url}/api/messages",
                json=message_data,
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                return (
                    result.get("message") == message_data["message"] and
                    result.get("from_user_id") == message_data["from_user_id"] and
                    "id" in result and
                    "timestamp" in result
                )
            return False
        except Exception as e:
            print(f"Create message test failed: {e}")
            return False

    def on_ws_message(self, ws, message, user_id):
        """Handle WebSocket message"""
        try:
            data = json.loads(message)
            if user_id not in self.received_messages:
                self.received_messages[user_id] = []
            self.received_messages[user_id].append(data)
            print(f"📨 User {user_id} received: {data.get('type', 'unknown')}")
        except Exception as e:
            print(f"Error handling WebSocket message: {e}")

    def on_ws_error(self, ws, error):
        """Handle WebSocket error"""
        print(f"WebSocket error: {error}")

    def on_ws_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close"""
        print(f"WebSocket closed: {close_status_code} - {close_msg}")

    def on_ws_open(self, ws, user_id):
        """Handle WebSocket open"""
        print(f"🔗 WebSocket connected for user {user_id}")

    def test_websocket_connection(self):
        """Test WebSocket connection"""
        try:
            user_id = "test_user_ws_1"
            username = "TestUserWS1"
            
            ws_url = f"{self.ws_url}/api/ws/{user_id}/{username}"
            print(f"Connecting to: {ws_url}")
            
            # Create WebSocket connection
            ws = websocket.WebSocketApp(
                ws_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close,
                on_open=lambda ws: self.on_ws_open(ws, user_id)
            )
            
            # Start WebSocket in a thread
            ws_thread = threading.Thread(target=ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection
            time.sleep(2)
            
            # Check if we received users-update message
            if user_id in self.received_messages:
                messages = self.received_messages[user_id]
                users_update_received = any(msg.get('type') == 'users-update' for msg in messages)
                if users_update_received:
                    print("✅ Received users-update message")
                    ws.close()
                    return True
            
            ws.close()
            return False
            
        except Exception as e:
            print(f"WebSocket connection test failed: {e}")
            return False

    def test_websocket_messaging(self):
        """Test WebSocket messaging between two users"""
        try:
            user1_id = "test_user_msg_1"
            user1_name = "TestUser1"
            user2_id = "test_user_msg_2"
            user2_name = "TestUser2"
            
            # Clear previous messages
            self.received_messages = {}
            
            # Create two WebSocket connections
            ws1_url = f"{self.ws_url}/api/ws/{user1_id}/{user1_name}"
            ws2_url = f"{self.ws_url}/api/ws/{user2_id}/{user2_name}"
            
            ws1 = websocket.WebSocketApp(
                ws1_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user1_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            ws2 = websocket.WebSocketApp(
                ws2_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user2_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Start both WebSockets
            ws1_thread = threading.Thread(target=ws1.run_forever)
            ws2_thread = threading.Thread(target=ws2.run_forever)
            ws1_thread.daemon = True
            ws2_thread.daemon = True
            
            ws1_thread.start()
            ws2_thread.start()
            
            # Wait for connections
            time.sleep(3)
            
            # Send a message from user1 to user2
            message = {
                "type": "send-message",
                "from_user_id": user1_id,
                "from_username": user1_name,
                "to_user_id": user2_id,
                "message": "Hello from WebSocket test!"
            }
            
            ws1.send(json.dumps(message))
            
            # Wait for message to be received
            time.sleep(2)
            
            # Check if user2 received the message
            success = False
            if user2_id in self.received_messages:
                for msg in self.received_messages[user2_id]:
                    if (msg.get('type') == 'receive-message' and 
                        msg.get('message', {}).get('message') == "Hello from WebSocket test!"):
                        success = True
                        print("✅ Message received by user2")
                        break
            
            # Close connections
            ws1.close()
            ws2.close()
            
            return success
            
        except Exception as e:
            print(f"WebSocket messaging test failed: {e}")
            return False

    def test_typing_indicators(self):
        """Test typing indicators via WebSocket"""
        try:
            user1_id = "test_user_typing_1"
            user1_name = "TestUser1"
            user2_id = "test_user_typing_2"
            user2_name = "TestUser2"
            
            # Clear previous messages
            self.received_messages = {}
            
            # Create two WebSocket connections
            ws1_url = f"{self.ws_url}/api/ws/{user1_id}/{user1_name}"
            ws2_url = f"{self.ws_url}/api/ws/{user2_id}/{user2_name}"
            
            ws1 = websocket.WebSocketApp(
                ws1_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user1_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            ws2 = websocket.WebSocketApp(
                ws2_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user2_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Start both WebSockets
            ws1_thread = threading.Thread(target=ws1.run_forever)
            ws2_thread = threading.Thread(target=ws2.run_forever)
            ws1_thread.daemon = True
            ws2_thread.daemon = True
            
            ws1_thread.start()
            ws2_thread.start()
            
            # Wait for connections
            time.sleep(3)
            
            # Send typing indicator from user1 to user2
            typing_message = {
                "type": "typing",
                "from_user_id": user1_id,
                "from_username": user1_name,
                "to_user_id": user2_id
            }
            
            ws1.send(json.dumps(typing_message))
            
            # Wait for typing indicator to be received
            time.sleep(2)
            
            # Check if user2 received the typing indicator
            success = False
            if user2_id in self.received_messages:
                for msg in self.received_messages[user2_id]:
                    if (msg.get('type') == 'typing' and 
                        msg.get('from_user_id') == user1_id):
                        success = True
                        print("✅ Typing indicator received")
                        break
            
            # Close connections
            ws1.close()
            ws2.close()
            
            return success
            
        except Exception as e:
            print(f"Typing indicators test failed: {e}")
            return False

    def test_call_signaling(self):
        """Test WebRTC call signaling via WebSocket"""
        try:
            user1_id = "test_user_call_1"
            user1_name = "TestUser1"
            user2_id = "test_user_call_2"
            user2_name = "TestUser2"
            
            # Clear previous messages
            self.received_messages = {}
            
            # Create two WebSocket connections
            ws1_url = f"{self.ws_url}/api/ws/{user1_id}/{user1_name}"
            ws2_url = f"{self.ws_url}/api/ws/{user2_id}/{user2_name}"
            
            ws1 = websocket.WebSocketApp(
                ws1_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user1_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            ws2 = websocket.WebSocketApp(
                ws2_url,
                on_message=lambda ws, msg: self.on_ws_message(ws, msg, user2_id),
                on_error=self.on_ws_error,
                on_close=self.on_ws_close
            )
            
            # Start both WebSockets
            ws1_thread = threading.Thread(target=ws1.run_forever)
            ws2_thread = threading.Thread(target=ws2.run_forever)
            ws1_thread.daemon = True
            ws2_thread.daemon = True
            
            ws1_thread.start()
            ws2_thread.start()
            
            # Wait for connections
            time.sleep(3)
            
            # Send call request from user1 to user2
            call_message = {
                "type": "call-user",
                "from_user_id": user1_id,
                "from_username": user1_name,
                "to_user_id": user2_id
            }
            
            ws1.send(json.dumps(call_message))
            
            # Wait for call signal to be received
            time.sleep(2)
            
            # Check if user2 received the incoming call
            success = False
            if user2_id in self.received_messages:
                for msg in self.received_messages[user2_id]:
                    if (msg.get('type') == 'incoming-call' and 
                        msg.get('from_user_id') == user1_id):
                        success = True
                        print("✅ Incoming call signal received")
                        break
            
            # Close connections
            ws1.close()
            ws2.close()
            
            return success
            
        except Exception as e:
            print(f"Call signaling test failed: {e}")
            return False

def main():
    print("🚀 Starting VidChat Pro Backend Tests")
    print("=" * 50)
    
    tester = VidChatProTester()
    
    # Run all tests
    tests = [
        ("API Health Check", tester.test_api_health),
        ("Messages Endpoint", tester.test_messages_endpoint),
        ("Create Message", tester.test_create_message),
        ("WebSocket Connection", tester.test_websocket_connection),
        ("WebSocket Messaging", tester.test_websocket_messaging),
        ("Typing Indicators", tester.test_typing_indicators),
        ("Call Signaling", tester.test_call_signaling)
    ]
    
    for test_name, test_func in tests:
        tester.run_test(test_name, test_func)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("❌ Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())