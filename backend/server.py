from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timezone
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    logger.info("MongoDB connected successfully")
except Exception as e:
    logger.warning(f"MongoDB connection error: {e}. Running in memory mode.")
    client = None
    db = None

app = FastAPI()

# Add CORS middleware BEFORE including routers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(',') if os.environ.get('CORS_ORIGINS') else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.users: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, username: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.users[user_id] = {
            "id": user_id,
            "username": username,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        logger.info(f"User {username} ({user_id}) connected")
        await self.broadcast_users_update()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.users:
            username = self.users[user_id]["username"]
            del self.users[user_id]
            logger.info(f"User {username} ({user_id}) disconnected")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(json.dumps(message))

    async def broadcast_users_update(self):
        message = {
            "type": "users-update",
            "users": list(self.users.values())
        }
        await self.broadcast(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")

manager = ConnectionManager()

# Pydantic Models
class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    from_username: str
    to_user_id: str
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    read: bool = False

class MessageCreate(BaseModel):
    from_user_id: str
    from_username: str
    to_user_id: str
    message: str

class Friend(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    friend_id: str
    friend_username: str
    status: str = "pending"  # pending, accepted, blocked
    added_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FriendRequest(BaseModel):
    from_user_id: str
    from_username: str
    to_user_id: str
    to_username: str

# REST API Routes
@api_router.get("/")
async def root():
    return {"message": "ConnectHub API"}

@api_router.get("/messages/{user1_id}/{user2_id}", response_model=List[Message])
async def get_messages(user1_id: str, user2_id: str):
    if db is None:
        return []
    
    try:
        messages = await db.messages.find(
            {
                "$or": [
                    {"from_user_id": user1_id, "to_user_id": user2_id},
                    {"from_user_id": user2_id, "to_user_id": user1_id}
                ]
            },
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        return messages
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        return []

@api_router.post("/messages", response_model=Message)
async def create_message(message_input: MessageCreate):
    message = Message(**message_input.model_dump())
    message_doc = message.model_dump()
    if db is not None:
        await db.messages.insert_one(message_doc)
    return message

# Friends Management Endpoints
@api_router.post("/friends/request")
async def send_friend_request(request: FriendRequest):
    """Send a friend request"""
    if db is not None:
        existing = await db.friends.find_one({
            "user_id": request.from_user_id,
            "friend_id": request.to_user_id
        })
        
        if existing:
            return {"error": "Friend request already exists"}
        
        friend_request = {
            "user_id": request.from_user_id,
            "username": request.from_username,
            "friend_id": request.to_user_id,
            "friend_username": request.to_username,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.friends.insert_one(friend_request)
        return {"status": "success", "message": "Friend request sent"}
    return {"status": "success"}

@api_router.get("/friends/{user_id}")
async def get_friends(user_id: str):
    """Get all friends for a user"""
    if db is None:
        return []
    
    friends = await db.friends.find({
        "$or": [
            {"user_id": user_id, "status": "accepted"},
            {"friend_id": user_id, "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(1000)
    return friends

@api_router.get("/friends/requests/{user_id}")
async def get_friend_requests(user_id: str):
    """Get pending friend requests for a user"""
    if db is None:
        return []
    
    requests = await db.friends.find({
        "friend_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(1000)
    return requests

@api_router.post("/friends/accept/{request_id}")
async def accept_friend_request(request_id: str):
    """Accept a friend request"""
    if db is not None:
        await db.friends.update_one(
            {"user_id": request_id},
            {"$set": {"status": "accepted"}}
        )
        return {"status": "success"}
    return {"status": "success"}

@api_router.get("/messages/unread/{user_id}")
async def get_unread_messages(user_id: str):
    """Get all unread messages for a user (offline messages)"""
    if db is None:
        return []
    
    try:
        unread = await db.messages.find({
            "to_user_id": user_id,
            "read": False
        }, {"_id": 0}).sort("timestamp", 1).to_list(1000)
        return unread
    except Exception as e:
        logger.error(f"Error fetching unread messages: {e}")
        return []

@api_router.post("/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark a message as read"""
    if db is not None:
        await db.messages.update_one(
            {"id": message_id},
            {"$set": {"read": True}}
        )
        return {"status": "success"}
    return {"status": "success"}

# WebSocket Route
@app.websocket("/api/ws/{user_id}/{username}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, username: str):
    await manager.connect(websocket, user_id, username)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            msg_type = message_data.get("type")

            if msg_type == "send-message":
                logger.info(f"Processing send-message: {message_data}")
                # Save message to DB
                message = Message(
                    from_user_id=message_data["from_user_id"],
                    from_username=message_data["from_username"],
                    to_user_id=message_data["to_user_id"],
                    message=message_data["message"]
                )
                if db is not None:
                    try:
                        await db.messages.insert_one(message.model_dump())
                        logger.info(f"Message saved to DB: {message.id}")
                    except Exception as e:
                        logger.error(f"Error saving message to DB: {e}")
                
                # Send to recipient
                msg_dict = message.model_dump()
                logger.info(f"Sending message to recipient {message_data['to_user_id']}: {msg_dict}")
                receive_message = {
                    "type": "receive-message",
                    "message": msg_dict
                }
                await manager.send_personal_message(receive_message, message_data["to_user_id"])
                # Confirm to sender
                logger.info(f"Sending message confirmation to sender {message_data['from_user_id']}")
                await manager.send_personal_message(receive_message, message_data["from_user_id"])

            elif msg_type == "typing":
                typing_msg = {
                    "type": "typing",
                    "from_user_id": message_data["from_user_id"],
                    "from_username": message_data["from_username"]
                }
                await manager.send_personal_message(typing_msg, message_data["to_user_id"])

            elif msg_type == "stop-typing":
                stop_typing_msg = {
                    "type": "stop-typing",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(stop_typing_msg, message_data["to_user_id"])

            # WebRTC Signaling
            elif msg_type == "call-user":
                call_msg = {
                    "type": "incoming-call",
                    "from_user_id": message_data["from_user_id"],
                    "from_username": message_data["from_username"]
                }
                await manager.send_personal_message(call_msg, message_data["to_user_id"])

            elif msg_type == "accept-call":
                accept_msg = {
                    "type": "call-accepted",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(accept_msg, message_data["to_user_id"])

            elif msg_type == "reject-call":
                reject_msg = {
                    "type": "call-rejected",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(reject_msg, message_data["to_user_id"])

            elif msg_type == "offer":
                offer_msg = {
                    "type": "offer",
                    "offer": message_data["offer"],
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(offer_msg, message_data["to_user_id"])

            elif msg_type == "answer":
                answer_msg = {
                    "type": "answer",
                    "answer": message_data["answer"],
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(answer_msg, message_data["to_user_id"])

            elif msg_type == "ice-candidate":
                ice_msg = {
                    "type": "ice-candidate",
                    "candidate": message_data["candidate"],
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(ice_msg, message_data["to_user_id"])

            elif msg_type == "end-call":
                end_msg = {
                    "type": "call-ended",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(end_msg, message_data["to_user_id"])

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_users_update()
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(user_id)
        await manager.broadcast_users_update()


app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()