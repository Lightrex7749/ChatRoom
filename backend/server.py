from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from passlib.context import CryptContext
import asyncio
import shutil
import mimetypes
from postgres_db import PostgresDB

import certifi

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# In-Memory Database for testing/fallback
class InMemoryDB:
    def __init__(self):
        self.data = {
            "messages": [],
            "users": [],
            "friends": [],
            "friend_requests": []
        }
    
    @property
    def messages(self):
        return InMemoryCollection(self.data, "messages")
    
    @property
    def users(self):
        return InMemoryCollection(self.data, "users")
    
    @property
    def friends(self):
        return InMemoryCollection(self.data, "friends")
    
    @property
    def friend_requests(self):
        return InMemoryCollection(self.data, "friend_requests")

class MockUpdateResult:
    def __init__(self, modified_count):
        self.modified_count = modified_count

class MockDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

class InMemoryCollection:
    def __init__(self, db, collection_name):
        self.db = db
        self.name = collection_name
    
    async def insert_one(self, doc):
        self.db[self.name].append(doc)
        return {"inserted_id": doc.get("id")}
    
    async def find_one(self, query):
        for doc in self.db[self.name]:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None
    
    def find(self, query=None, projection=None):
        return InMemoryCursor(self.db[self.name], query or {}, projection or {})
    
    async def update_one(self, query, update):
        for doc in self.db[self.name]:
            if all(doc.get(k) == v for k, v in query.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                return MockUpdateResult(1)
        return MockUpdateResult(0)
    
    async def delete_one(self, query):
        for i, doc in enumerate(self.db[self.name]):
            if all(doc.get(k) == v for k, v in query.items()):
                self.db[self.name].pop(i)
                return MockDeleteResult(1)
        return MockDeleteResult(0)

class InMemoryCursor:
    def __init__(self, collection, query, projection):
        self.collection = collection
        self.query = query
        self.projection = projection
        self._results = None
        self._sort_key = None
        self._sort_dir = 1
        self._iterator = None
    
    def sort(self, key, direction=1):
        self._sort_key = key
        self._sort_dir = direction
        return self
    
    def _execute_query(self):
        if self._results is not None:
            return

        results = []
        for doc in self.collection:
            # Complex filtering logic matching MongoDB query structure minimally
            match = True
            for k, v in self.query.items():
                if k == "$or":
                    # Handle $or: list of conditions, one must be true
                    or_match = False
                    for or_clause in v:
                        clause_match = True
                        for k2, v2 in or_clause.items():
                            if doc.get(k2) != v2:
                                clause_match = False
                                break
                        if clause_match:
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            
            if match:
                results.append(doc)
        
        if self._sort_key:
            results.sort(key=lambda x: x.get(self._sort_key, ""), reverse=(self._sort_dir == -1))

        
        self._results = results

    async def to_list(self, max_size):
        self._execute_query()
        if max_size is None or max_size == 0:
            return self._results
        return self._results[:max_size]

    def __aiter__(self):
        self._execute_query()
        self._iterator = iter(self._results)
        return self

    async def __anext__(self):
        if self._iterator is None:
            self._execute_query()
            self._iterator = iter(self._results)
        
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Database configuration
database_url = os.environ.get('DATABASE_URL', '')  # PostgreSQL URL from Render
mongo_url = os.environ.get('MONGO_URL', '')  # MongoDB URL (legacy)
db_name = os.environ.get('DB_NAME', 'chatroom_db')

# Initialize database
client = None
db = None
postgres_db = None

async def init_db():
    """Initialize database connection on startup"""
    global db, postgres_db
    
    # Try PostgreSQL first
    if database_url:
        try:
            logger.info("Attempting PostgreSQL connection...")
            postgres_db = PostgresDB(database_url)
            await postgres_db.connect()
            db = postgres_db
            logger.info("[OK] PostgreSQL connected successfully")
            return
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
    
    # Try MongoDB if no PostgreSQL
    if mongo_url:
        try:
            logger.info("Attempting MongoDB connection...")
            global client
            client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=10000,  # Increased from 2s to 10s for deployed servers
                connectTimeoutMS=10000,  # Connection timeout
                socketTimeoutMS=30000,  # Socket timeout for operations
                retryWrites=True,  # Retry failed writes
                maxPoolSize=50,  # Connection pooling
                tlsCAFile=certifi.where(),
                tlsAllowInvalidCertificates=True
            )
            db = client[db_name]
            logger.info("[OK] MongoDB connected")
            return
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}")
    
    # Fallback to InMemoryDB
    logger.warning("[WARNING] Using InMemoryDB (data will be lost on restart)")
    db = InMemoryDB()

async def close_db():
    """Close database connection on shutdown"""
    if postgres_db:
        await postgres_db.close()
    if client:
        client.close()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

# Mount static files for serving uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
        for connection in list(self.active_connections.values()):
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")

manager = ConnectionManager()

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: str
    username: str
    created_at: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    from_username: str = ""
    to_user_id: str
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    read: bool = False
    deleted: bool = False
    edited_at: str | None = None
    file_url: str | None = None
    file_type: str | None = None  # "image", "video", "file", "audio"
    file_name: str | None = None
    reactions: Dict[str, List[str]] = Field(default_factory=dict)  # emoji -> [user_ids]
    reply_to_id: str | None = None  # ID of message being replied to
    reply_to_text: str | None = None  # Original message text
    reply_to_username: str | None = None  # Original sender username
    type: str | None = None  # "call-log" for call history
    call_status: str | None = None  # "missed", "rejected", "completed"
    duration: int | None = None  # call duration in seconds

class MessageCreate(BaseModel):
    from_user_id: str
    from_username: str
    to_user_id: str
    message: str
    file_url: str | None = None
    file_type: str | None = None
    file_name: str | None = None
    reply_to_id: str | None = None
    reply_to_text: str | None = None
    reply_to_username: str | None = None

class MessageEdit(BaseModel):
    message: str

class MessageReaction(BaseModel):
    emoji: str

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
    to_user_id: Optional[str] = None
    to_username: str

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_file_type(filename: str) -> str:
    """Determine file type based on extension"""
    mime_type, _ = mimetypes.guess_type(filename)
    if mime_type:
        if mime_type.startswith('image/'):
            return 'image'
        elif mime_type.startswith('video/'):
            return 'video'
    return 'file'

# REST API Routes
@api_router.get("/")
async def root():
    return {"message": "ConnectHub API"}

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and return its URL"""
    try:
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file type
        file_type = get_file_type(file.filename)
        
        return {
            "file_url": f"/uploads/{unique_filename}",
            "file_name": file.filename,
            "file_type": file_type
        }
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/register", response_model=User)
async def register(user: UserCreate):
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        existing_user = await db.users.find_one({"username": user.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        user_id = str(uuid.uuid4())
        hashed_password = get_password_hash(user.password)
        
        new_user = {
            "id": user_id,
            "username": user.username,
            "hashed_password": hashed_password,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(new_user)
        
        return User(
            id=user_id,
            username=user.username,
            created_at=new_user["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/login", response_model=User)
async def login(user_in: UserLogin):
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    user = await db.users.find_one({"username": user_in.username})
    if not user or not verify_password(user_in.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    return User(
        id=user["id"],
        username=user["username"],
        created_at=user["created_at"]
    )

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
    except Exception:
        # Gracefully return empty list if DB unavailable
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
async def send_friend_request(req_data: FriendRequest):
    """Send a friend request"""
    logger.info(f"Received friend request: {req_data}")
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")

    # Look up the recipient user by username - check WebSocket connections first
    recipient = await db.users.find_one({"username": req_data.to_username})
    
    # If not in db.users, check if they're connected via WebSocket
    if not recipient:
        # Find user in active connections by username
        recipient_id = None
        for user_id, user_info in manager.users.items():
            if user_info.get("username") == req_data.to_username:
                recipient_id = user_id
                break
        
        if not recipient_id:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        recipient_id = recipient["id"]
    
    if recipient_id == req_data.from_user_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    existing = await db.friends.find_one({
        "user_id": req_data.from_user_id,
        "friend_id": recipient_id
    })
    
    if existing:
        return {"error": "Friend request already exists or you are already friends"}
    
    # Store request for BOTH sides (or handle relationally, but here we store simple docs)
    # We'll store a "request" document.
    friend_request_doc = {
        "user_id": req_data.from_user_id,
        "username": req_data.from_username,
        "friend_id": recipient_id,
        "friend_username": req_data.to_username,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.friends.insert_one(friend_request_doc)
    return {"status": "success", "message": "Friend request sent"}

@api_router.get("/friends/{user_id}")
async def get_friends(user_id: str):
    """Get all friends for a user"""
    if db is None:
        return []
    
    # Logic: Find where I am user_id AND status=accepted, OR where I am friend_id AND status=accepted
    friends_list = []
    
    # Case 1: I sent request and it was accepted
    cursor1 = db.friends.find({"user_id": user_id, "status": "accepted"}, {"_id": 0})
    async for doc in cursor1:
        friends_list.append({
            "friend_id": doc["friend_id"],
            "friend_username": doc["friend_username"]
        })
        
    # Case 2: Someone sent me request and it was accepted
    cursor2 = db.friends.find({"friend_id": user_id, "status": "accepted"}, {"_id": 0})
    async for doc in cursor2:
        friends_list.append({
            "friend_id": doc["user_id"],
            "friend_username": doc["username"]
        })

    # Add online status for each friend
    for friend in friends_list:
        friend["is_online"] = friend["friend_id"] in manager.active_connections
    
    return friends_list

@api_router.get("/users/online")
async def get_online_users():
    """Get list of all online users"""
    online_users = []
    for user_id, user_info in manager.users.items():
        online_users.append({
            "id": user_id,
            "username": user_info["username"],
            "is_online": True
        })
    return online_users

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

@api_router.post("/friends/accept/{request_from_user_id}/{current_user_id}")
async def accept_friend_request(request_from_user_id: str, current_user_id: str):
    """Accept a friend request"""
    if db is not None:
        result = await db.friends.update_one(
            {
                "user_id": request_from_user_id, 
                "friend_id": current_user_id,
                "status": "pending"
            },
            {"$set": {"status": "accepted"}}
        )
        if result.modified_count == 0:
             raise HTTPException(status_code=404, detail="Friend request not found")
        return {"status": "success"}
    return {"status": "success"}


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

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str):
    """Delete a message (soft delete)"""
    if db is not None:
        await db.messages.update_one(
            {"id": message_id},
            {"$set": {"deleted": True}}
        )
    return {"status": "success"}

@api_router.put("/messages/{message_id}")
async def edit_message(message_id: str, message_edit: MessageEdit):
    """Edit a message"""
    if db is not None:
        await db.messages.update_one(
            {"id": message_id},
            {"$set": {"message": message_edit.message, "edited_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"status": "success"}

@api_router.post("/messages/{message_id}/react")
async def react_to_message(message_id: str, user_id: str, reaction: MessageReaction):
    """Add or remove a reaction to a message"""
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get("reactions", {})
    emoji = reaction.emoji
    
    if emoji not in reactions:
        reactions[emoji] = []
    
    # Toggle reaction: remove if exists, add if doesn't
    if user_id in reactions[emoji]:
        reactions[emoji].remove(user_id)
        if not reactions[emoji]:  # Remove emoji if no users
            del reactions[emoji]
    else:
        reactions[emoji].append(user_id)
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    return {"status": "success", "reactions": reactions}

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
                # Create message object with optional file data and reply
                message = Message(
                    from_user_id=message_data["from_user_id"],
                    from_username=message_data["from_username"],
                    to_user_id=message_data["to_user_id"],
                    message=message_data["message"],
                    file_url=message_data.get("file_url"),
                    file_type=message_data.get("file_type"),
                    file_name=message_data.get("file_name"),
                    reply_to_id=message_data.get("reply_to_id"),
                    reply_to_text=message_data.get("reply_to_text"),
                    reply_to_username=message_data.get("reply_to_username")
                )
                # Save to DB asynchronously (don't wait - fire and forget)
                if db is not None:
                    try:
                        asyncio.create_task(db.messages.insert_one(message.model_dump()))
                    except Exception:
                        pass
                
                # Send to recipient immediately without waiting for DB
                msg_dict = message.model_dump()
                receive_message = {
                    "type": "receive-message",
                    "message": msg_dict
                }
                await manager.send_personal_message(receive_message, message_data["to_user_id"])
                # Confirm to sender
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

            elif msg_type == "message-read":
                # Mark message as read and notify sender
                if db is not None:
                    asyncio.create_task(db.messages.update_one(
                        {"id": message_data["message_id"]},
                        {"$set": {"read": True}}
                    ))
                # Notify the sender that message was read
                read_msg = {
                    "type": "message-read",
                    "message_id": message_data["message_id"],
                    "read_by": message_data["from_user_id"]
                }
                await manager.send_personal_message(read_msg, message_data["to_user_id"])

            elif msg_type == "delete-message":
                # Delete message
                if db is not None:
                    asyncio.create_task(db.messages.update_one(
                        {"id": message_data["message_id"]},
                        {"$set": {"deleted": True}}
                    ))
                # Notify both users
                delete_msg = {
                    "type": "delete-message",
                    "message_id": message_data["message_id"]
                }
                await manager.send_personal_message(delete_msg, message_data["to_user_id"])
                await manager.send_personal_message(delete_msg, message_data["from_user_id"])

            elif msg_type == "edit-message":
                # Edit message
                if db is not None:
                    asyncio.create_task(db.messages.update_one(
                        {"id": message_data["message_id"]},
                        {"$set": {"message": message_data["new_message"], "edited_at": datetime.now(timezone.utc).isoformat()}}
                    ))
                # Notify both users
                edit_msg = {
                    "type": "edit-message",
                    "message_id": message_data["message_id"],
                    "new_message": message_data["new_message"],
                    "edited_at": datetime.now(timezone.utc).isoformat()
                }
                await manager.send_personal_message(edit_msg, message_data["to_user_id"])
                await manager.send_personal_message(edit_msg, message_data["from_user_id"])

            elif msg_type == "react-message":
                # Add/remove reaction
                if db is not None:
                    message = await db.messages.find_one({"id": message_data["message_id"]})
                    if message:
                        reactions = message.get("reactions", {})
                        emoji = message_data["emoji"]
                        reactor_id = message_data["user_id"]
                        
                        if emoji not in reactions:
                            reactions[emoji] = []
                        
                        # Toggle reaction
                        if reactor_id in reactions[emoji]:
                            reactions[emoji].remove(reactor_id)
                            if not reactions[emoji]:
                                del reactions[emoji]
                        else:
                            reactions[emoji].append(reactor_id)
                        
                        asyncio.create_task(db.messages.update_one(
                            {"id": message_data["message_id"]},
                            {"$set": {"reactions": reactions}}
                        ))
                        
                        # Notify both users
                        reaction_msg = {
                            "type": "message-reaction",
                            "message_id": message_data["message_id"],
                            "reactions": reactions
                        }
                        await manager.send_personal_message(reaction_msg, message_data["to_user_id"])
                        await manager.send_personal_message(reaction_msg, message_data["from_user_id"])

            # WebRTC Signaling
            elif msg_type == "call-user":
                # Create call-started log message
                call_started = Message(
                    from_user_id=message_data["from_user_id"],
                    from_username=message_data.get("from_username", ""),
                    to_user_id=message_data["to_user_id"],
                    message="",
                    type="call-log",
                    call_status="ongoing"
                )
                
                logger.info(f"[CALL-USER] Creating call-started message: {call_started.model_dump()}")
                
                # Send call-started message to both users
                call_started_msg = {
                    "type": "receive-message",
                    "message": call_started.model_dump()
                }
                logger.info(f"[CALL-USER] Sending call-started to receiver: {message_data['to_user_id']}")
                await manager.send_personal_message(call_started_msg, message_data["to_user_id"])
                logger.info(f"[CALL-USER] Sending call-started to caller: {message_data['from_user_id']}")
                await manager.send_personal_message(call_started_msg, message_data["from_user_id"])
                
                # Also send incoming-call notification
                incoming_msg = {
                    "type": "incoming-call",
                    "from_user_id": message_data["from_user_id"],
                    "from_username": message_data["from_username"],
                    "video_enabled": message_data.get("video_enabled", True)
                }
                await manager.send_personal_message(incoming_msg, message_data["to_user_id"])

            elif msg_type == "accept-call":
                accept_msg = {
                    "type": "call-accepted",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(accept_msg, message_data["to_user_id"])

            elif msg_type == "reject-call":
                # Save call log as rejected
                call_log = Message(
                    from_user_id=message_data["from_user_id"],
                    from_username=message_data.get("from_username", ""),
                    to_user_id=message_data["to_user_id"],
                    message="",
                    type="call-log",
                    call_status="rejected"
                )
                
                logger.info(f"[REJECT-CALL] Creating call log: {call_log.model_dump()}")
                
                # Save to DB
                if db is not None:
                    try:
                        asyncio.create_task(db.messages.insert_one(call_log.model_dump()))
                        logger.info(f"[REJECT-CALL] Saved to database")
                    except Exception as e:
                        logger.error(f"Error saving call log: {e}")
                
                reject_msg = {
                    "type": "call-rejected",
                    "from_user_id": message_data["from_user_id"]
                }
                await manager.send_personal_message(reject_msg, message_data["to_user_id"])
                
                # Send call log to both users
                call_log_msg = {
                    "type": "receive-message",
                    "message": call_log.model_dump()
                }
                logger.info(f"[REJECT-CALL] Sending call log message to both users")
                await manager.send_personal_message(call_log_msg, message_data["to_user_id"])
                await manager.send_personal_message(call_log_msg, message_data["from_user_id"])

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
                # Get call duration if provided
                duration = message_data.get("duration", 0)
                
                # Save call log as completed
                call_log = Message(
                    from_user_id=message_data["from_user_id"],
                    from_username=message_data.get("from_username", ""),
                    to_user_id=message_data["to_user_id"],
                    message="",
                    type="call-log",
                    call_status="completed",
                    duration=duration
                )
                
                logger.info(f"[END-CALL] Creating call log: {call_log.model_dump()}")
                
                # Save to DB
                if db is not None:
                    try:
                        asyncio.create_task(db.messages.insert_one(call_log.model_dump()))
                        logger.info(f"[END-CALL] Saved to database")
                    except Exception as e:
                        logger.error(f"Error saving call log: {e}")
                
                # Send call-ended notification to BOTH users
                end_msg = {
                    "type": "call-ended",
                    "from_user_id": message_data["from_user_id"]
                }
                remote_user_id = message_data["to_user_id"]
                logger.info(f"[END-CALL] Attempting to send call-ended to user: {remote_user_id}")
                logger.info(f"[END-CALL] Active connections: {list(manager.active_connections.keys())}")
                logger.info(f"[END-CALL] Is remote user connected? {remote_user_id in manager.active_connections}")
                
                if remote_user_id in manager.active_connections:
                    await manager.send_personal_message(end_msg, remote_user_id)
                    logger.info(f"[END-CALL] Successfully sent call-ended to {remote_user_id}")
                else:
                    logger.warning(f"[END-CALL] Remote user {remote_user_id} is not connected")

                
                # Send call log to both users
                call_log_msg = {
                    "type": "receive-message",
                    "message": call_log.model_dump()
                }
                logger.info(f"[END-CALL] Sending call log message to both users")
                await manager.send_personal_message(call_log_msg, message_data["to_user_id"])
                await manager.send_personal_message(call_log_msg, message_data["from_user_id"])

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