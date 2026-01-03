import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_path))

from server import app, InMemoryDB
import server

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    server.db = InMemoryDB()
    server.manager.active_connections = {}
    server.manager.users = {}

def test_websocket_chat_flow():
    # We need two users
    u1_id = "user1-id"
    u1_name = "user1"
    u2_id = "user2-id"
    u2_name = "user2"

    with client.websocket_connect(f"/api/ws/{u1_id}/{u1_name}") as ws1:
        # Check if u1 gets user update (self)
        data = ws1.receive_json()
        assert data["type"] == "users-update"
        assert len(data["users"]) == 1
        
        with client.websocket_connect(f"/api/ws/{u2_id}/{u2_name}") as ws2:
            # Check if u2 gets user update (2 users)
            data2 = ws2.receive_json()
            assert data2["type"] == "users-update"
            assert len(data2["users"]) == 2

            # u1 should also receive user update about u2
            data1 = ws1.receive_json()
            assert data1["type"] == "users-update"
            assert len(data1["users"]) == 2

            # 1. User 1 sends message to User 2
            msg_payload = {
                "type": "send-message",
                "from_user_id": u1_id,
                "from_username": u1_name,
                "to_user_id": u2_id,
                "message": "Hello via WS"
            }
            ws1.send_json(msg_payload)

            # User 2 receives message
            received_msg = ws2.receive_json()
            assert received_msg["type"] == "receive-message"
            assert received_msg["message"]["message"] == "Hello via WS"
            assert received_msg["message"]["from_user_id"] == u1_id

            # User 1 also receives confirmation (logic in server sends to both)
            confirm_msg = ws1.receive_json()
            assert confirm_msg["type"] == "receive-message"
            assert confirm_msg["message"]["message"] == "Hello via WS"

            # 2. Typing Indicator
            typing_payload = {
                "type": "typing",
                "from_user_id": u1_id,
                "from_username": u1_name,
                "to_user_id": u2_id
            }
            ws1.send_json(typing_payload)
            
            typing_received = ws2.receive_json()
            assert typing_received["type"] == "typing"
            assert typing_received["from_user_id"] == u1_id

            # 3. WebRTC Call Signal
            call_payload = {
                "type": "call-user",
                "from_user_id": u1_id,
                "from_username": u1_name,
                "to_user_id": u2_id
            }
            ws1.send_json(call_payload)

            call_received = ws2.receive_json()
            assert call_received["type"] == "incoming-call"
            assert call_received["from_user_id"] == u1_id

            # 4. Message Read
            # Assume message_id is from the previous message
            msg_id = received_msg["message"]["id"]
            read_payload = {
                "type": "message-read",
                "message_id": msg_id,
                "from_user_id": u2_id,  # Reader
                "to_user_id": u1_id     # Sender
            }
            ws2.send_json(read_payload)

            read_confirm = ws1.receive_json()
            assert read_confirm["type"] == "message-read"
            assert read_confirm["message_id"] == msg_id

            # 5. Stop Typing
            stop_typing_payload = {
                "type": "stop-typing",
                "from_user_id": u1_id,
                "to_user_id": u2_id
            }
            ws1.send_json(stop_typing_payload)
            stop_typing_received = ws2.receive_json()
            assert stop_typing_received["type"] == "stop-typing"

            # 6. Edit Message via WS
            edit_payload = {
                "type": "edit-message",
                "message_id": msg_id,
                "new_message": "Edited via WS",
                "from_user_id": u1_id,
                "to_user_id": u2_id
            }
            ws1.send_json(edit_payload)
            edit_received = ws2.receive_json()
            assert edit_received["type"] == "edit-message"
            assert edit_received["new_message"] == "Edited via WS"
            # Sender also gets it
            ws1.receive_json()

            # 7. React Message via WS
            react_payload = {
                "type": "react-message",
                "message_id": msg_id,
                "emoji": "❤️",
                "user_id": u1_id,
                "from_user_id": u1_id,
                "to_user_id": u2_id
            }
            ws1.send_json(react_payload)
            react_received = ws2.receive_json()
            assert react_received["type"] == "message-reaction"
            assert u1_id in react_received["reactions"]["❤️"]
            ws1.receive_json()

            # 8. WebRTC Handshake (Accept, Offer, Answer, ICE)
            # Accept Call
            accept_payload = {
                "type": "accept-call",
                "from_user_id": u2_id,
                "to_user_id": u1_id
            }
            ws2.send_json(accept_payload)
            accept_received = ws1.receive_json()
            assert accept_received["type"] == "call-accepted"

            # Offer
            offer_payload = {
                "type": "offer",
                "offer": {"sdp": "mock-sdp", "type": "offer"},
                "from_user_id": u1_id,
                "to_user_id": u2_id
            }
            ws1.send_json(offer_payload)
            offer_received = ws2.receive_json()
            assert offer_received["type"] == "offer"
            
            # Answer
            answer_payload = {
                "type": "answer",
                "answer": {"sdp": "mock-answer", "type": "answer"},
                "from_user_id": u2_id,
                "to_user_id": u1_id
            }
            ws2.send_json(answer_payload)
            answer_received = ws1.receive_json()
            assert answer_received["type"] == "answer"

            # ICE Candidate
            ice_payload = {
                "type": "ice-candidate",
                "candidate": "candidate:...",
                "from_user_id": u1_id,
                "to_user_id": u2_id
            }
            ws1.send_json(ice_payload)
            ice_received = ws2.receive_json()
            assert ice_received["type"] == "ice-candidate"


