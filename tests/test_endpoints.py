import sys
import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add backend to path so we can import server
backend_path = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_path))

from server import app, InMemoryDB
import server

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    """Reset the in-memory database and connection manager before each test."""
    server.db = InMemoryDB()
    server.manager.active_connections = {}
    server.manager.users = {}

def test_root():
    response = client.get("/api/")
    assert response.status_code == 200
    assert response.json() == {"message": "ConnectHub API"}

def test_register_login_flow():
    # 1. Register
    user_data = {"username": "testuser", "password": "password123"}
    response = client.post("/api/register", json=user_data)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert "id" in data
    user_id = data["id"]

    # 2. Login
    login_data = {"username": "testuser", "password": "password123"}
    response = client.post("/api/login", json=login_data)
    assert response.status_code == 200
    login_res = response.json()
    assert login_res["id"] == user_id
    assert login_res["username"] == "testuser"

    # 3. Duplicate Register
    response = client.post("/api/register", json=user_data)
    assert response.status_code == 400  # Username already registered

    # 4. Invalid Login
    response = client.post("/api/login", json={"username": "testuser", "password": "wrongpassword"})
    assert response.status_code == 401

def test_friends_flow():
    # Register two users
    u1 = client.post("/api/register", json={"username": "user1", "password": "pw"}).json()
    u2 = client.post("/api/register", json={"username": "user2", "password": "pw"}).json()

    # User 1 sends friend request to User 2
    req_data = {
        "from_user_id": u1["id"],
        "from_username": u1["username"],
        "to_username": u2["username"]
    }
    response = client.post("/api/friends/request", json=req_data)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # User 2 checks requests
    response = client.get(f"/api/friends/requests/{u2['id']}")
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) == 1
    assert requests[0]["username"] == "user1"

    # User 2 accepts request
    response = client.post(f"/api/friends/accept/{u1['id']}/{u2['id']}")
    assert response.status_code == 200

    # Check friends list for User 1
    response = client.get(f"/api/friends/{u1['id']}")
    assert response.status_code == 200
    friends1 = response.json()
    assert len(friends1) == 1
    assert friends1[0]["friend_username"] == "user2"

    # Check friends list for User 2
    response = client.get(f"/api/friends/{u2['id']}")
    assert response.status_code == 200
    friends2 = response.json()
    assert len(friends2) == 1
    assert friends2[0]["friend_username"] == "user1"

def test_messaging_flow():
    # Register two users
    u1 = client.post("/api/register", json={"username": "msg_u1", "password": "pw"}).json()
    u2 = client.post("/api/register", json={"username": "msg_u2", "password": "pw"}).json()

    # Send message u1 -> u2
    msg_data = {
        "from_user_id": u1["id"],
        "from_username": u1["username"],
        "to_user_id": u2["id"],
        "message": "Hello World"
    }
    response = client.post("/api/messages", json=msg_data)
    assert response.status_code == 200
    msg = response.json()
    assert msg["message"] == "Hello World"
    msg_id = msg["id"]

    # Get messages
    response = client.get(f"/api/messages/{u1['id']}/{u2['id']}")
    assert response.status_code == 200
    msgs = response.json()
    assert len(msgs) == 1
    assert msgs[0]["id"] == msg_id

    # Edit message
    edit_data = {"message": "Hello Edited"}
    response = client.put(f"/api/messages/{msg_id}", json=edit_data)
    assert response.status_code == 200

    # Verify edit
    response = client.get(f"/api/messages/{u1['id']}/{u2['id']}")
    assert response.json()[0]["message"] == "Hello Edited"

    # React to message
    react_data = {"emoji": "👍"}
    response = client.post(f"/api/messages/{msg_id}/react?user_id={u2['id']}", json=react_data)
    assert response.status_code == 200
    
    # Verify reaction
    response = client.get(f"/api/messages/{u1['id']}/{u2['id']}")
    reactions = response.json()[0]["reactions"]
    assert "👍" in reactions
    assert u2["id"] in reactions["👍"]

    # Delete message
    response = client.delete(f"/api/messages/{msg_id}")
    assert response.status_code == 200
    
    # Verify delete (soft delete)
    response = client.get(f"/api/messages/{u1['id']}/{u2['id']}")
    assert response.json()[0]["deleted"] is True

def test_file_upload_mock():
    # Mock file upload
    files = {'file': ('test.txt', b'test content', 'text/plain')}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "file_url" in data
    assert data["file_name"] == "test.txt"
    assert data["file_type"] == "file"

def test_unread_messages():
    # Register two users
    u1 = client.post("/api/register", json={"username": "unread_u1", "password": "pw"}).json()
    u2 = client.post("/api/register", json={"username": "unread_u2", "password": "pw"}).json()

    # User 1 sends message to User 2
    msg_data = {
        "from_user_id": u1["id"],
        "from_username": u1["username"],
        "to_user_id": u2["id"],
        "message": "Unread Msg"
    }
    client.post("/api/messages", json=msg_data)

    # DEBUG: Get all messages between users to see if it was saved
    all_msgs = client.get(f"/api/messages/{u1['id']}/{u2['id']}").json()
    assert len(all_msgs) == 1
    assert all_msgs[0]["read"] is False
    assert all_msgs[0]["to_user_id"] == u2["id"]

    # Check unread for User 2
    response = client.get(f"/api/messages/unread/{u2['id']}")

    assert response.status_code == 200
    unread = response.json()
    assert len(unread) == 1
    assert unread[0]["message"] == "Unread Msg"
    assert unread[0]["read"] is False

    # Mark as read via API
    msg_id = unread[0]["id"]
    client.post(f"/api/messages/{msg_id}/read")

    # Check unread again
    response = client.get(f"/api/messages/unread/{u2['id']}")
    assert len(response.json()) == 0

def test_friend_request_invalid_user():
    # Register one user
    u1 = client.post("/api/register", json={"username": "fr_u1", "password": "pw"}).json()
    
    # Try to send friend request to non-existent user
    req_data = {
        "from_user_id": u1["id"],
        "from_username": u1["username"],
        "to_username": "non_existent_user_999"
    }
    response = client.post("/api/friends/request", json=req_data)
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]

def test_friend_request_to_self():
    u1 = client.post("/api/register", json={"username": "self_u1", "password": "pw"}).json()
    
    req_data = {
        "from_user_id": u1["id"],
        "from_username": u1["username"],
        "to_username": u1["username"]
    }
    response = client.post("/api/friends/request", json=req_data)
    assert response.status_code == 400
    assert "Cannot send friend request to yourself" in response.json()["detail"]

