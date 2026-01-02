import requests
import json

BASE_URL = "http://127.0.0.1:5000/api"

def run_test():
    # 1. Register User 1
    resp1 = requests.post(f"{BASE_URL}/register", json={"username": "testuser1", "password": "password"})
    if resp1.status_code != 200:
        print(f"User 1 reg failed: {resp1.text}")
        # Try login if already exists
        resp1 = requests.post(f"{BASE_URL}/login", json={"username": "testuser1", "password": "password"})
    
    user1 = resp1.json()
    print(f"User 1: {user1['id']}")

    # 2. Register User 2
    resp2 = requests.post(f"{BASE_URL}/register", json={"username": "testuser2", "password": "password"})
    if resp2.status_code != 200:
        print(f"User 2 reg failed: {resp2.text}")
        resp2 = requests.post(f"{BASE_URL}/login", json={"username": "testuser2", "password": "password"})

    user2 = resp2.json()
    print(f"User 2: {user2['id']}")

    # 3. Send Friend Request (User 1 -> User 2)
    req_data = {
        "from_user_id": user1['id'],
        "from_username": user1['username'],
        "to_username": user2['username']
    }
    resp_req = requests.post(f"{BASE_URL}/friends/request", json=req_data)
    print(f"Request sent: {resp_req.json()}")

    # 4. Accept Friend Request (User 2 accepts User 1)
    # The endpoint is /friends/accept/{request_from_user_id}/{current_user_id}
    # So: /friends/accept/{user1.id}/{user2.id}
    accept_url = f"{BASE_URL}/friends/accept/{user1['id']}/{user2['id']}"
    resp_accept = requests.post(accept_url)
    
    if resp_accept.status_code == 200:
        print("Friend request accepted successfully!")
    else:
        print(f"Accept failed: {resp_accept.status_code} - {resp_accept.text}")

if __name__ == "__main__":
    run_test()