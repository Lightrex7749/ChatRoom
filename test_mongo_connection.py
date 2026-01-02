import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
print(f"Testing connection to: {MONGO_URL.split('@')[1]}") # Hide credentials

async def test_connection():
    try:
        client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where()
        )
        print("Attempting to get server info...")
        info = await client.server_info()
        print(f"Successfully connected! Server version: {info.get('version')}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())