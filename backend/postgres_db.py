"""PostgreSQL database layer for chatroom"""
import os
import asyncpg
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class PostgresDB:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool = None
        
    async def connect(self):
        """Create connection pool"""
        try:
            self.pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=10)
            await self._create_tables()
            logger.info("PostgreSQL connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
    
    async def _create_tables(self):
        """Create tables if they don't exist"""
        async with self.pool.acquire() as conn:
            # Users table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            ''')
            
            # Messages table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    from_user_id TEXT NOT NULL,
                    from_username TEXT NOT NULL,
                    to_user_id TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    read BOOLEAN DEFAULT FALSE,
                    deleted BOOLEAN DEFAULT FALSE,
                    edited_at TEXT,
                    file_url TEXT,
                    file_type TEXT,
                    file_name TEXT
                )
            ''')
            
            # Friends table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS friends (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    friend_id TEXT NOT NULL,
                    friend_username TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            ''')
            
            logger.info("PostgreSQL tables created/verified")
    
    @property
    def users(self):
        return PostgresUsersCollection(self.pool)
    
    @property
    def messages(self):
        return PostgresMessagesCollection(self.pool)
    
    @property
    def friends(self):
        return PostgresFriendsCollection(self.pool)


class PostgresUsersCollection:
    def __init__(self, pool):
        self.pool = pool
    
    async def insert_one(self, doc: dict):
        async with self.pool.acquire() as conn:
            await conn.execute(
                'INSERT INTO users (id, username, hashed_password, created_at) VALUES ($1, $2, $3, $4)',
                doc['id'], doc['username'], doc['hashed_password'], doc['created_at']
            )
        return {"inserted_id": doc['id']}
    
    async def find_one(self, query: dict):
        async with self.pool.acquire() as conn:
            if 'username' in query:
                row = await conn.fetchrow('SELECT * FROM users WHERE username = $1', query['username'])
            elif 'id' in query:
                row = await conn.fetchrow('SELECT * FROM users WHERE id = $1', query['id'])
            else:
                return None
            
            if row:
                return dict(row)
            return None


class PostgresMessagesCollection:
    def __init__(self, pool):
        self.pool = pool
    
    async def insert_one(self, doc: dict):
        async with self.pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO messages (id, from_user_id, from_username, to_user_id, message, timestamp, read, deleted, edited_at, file_url, file_type, file_name)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ''', doc['id'], doc['from_user_id'], doc['from_username'], doc['to_user_id'], 
                doc['message'], doc['timestamp'], doc.get('read', False), doc.get('deleted', False),
                doc.get('edited_at'), doc.get('file_url'), doc.get('file_type'), doc.get('file_name'))
        return {"inserted_id": doc['id']}
    
    def find(self, query=None, projection=None):
        return PostgresMessagesCursor(self.pool, query or {})
    
    async def update_one(self, query: dict, update: dict):
        async with self.pool.acquire() as conn:
            if '$set' in update:
                set_clause = update['$set']
                if 'id' in query:
                    # Build dynamic UPDATE query
                    set_parts = []
                    values = []
                    idx = 1
                    for k, v in set_clause.items():
                        set_parts.append(f"{k} = ${idx}")
                        values.append(v)
                        idx += 1
                    values.append(query['id'])
                    
                    sql = f"UPDATE messages SET {', '.join(set_parts)} WHERE id = ${idx}"
                    result = await conn.execute(sql, *values)
                    count = int(result.split()[-1]) if result else 0
                    return type('Result', (), {'modified_count': count})()
        return type('Result', (), {'modified_count': 0})()


class PostgresMessagesCursor:
    def __init__(self, pool, query):
        self.pool = pool
        self.query = query
        self._sort_field = None
        self._sort_direction = 'ASC'
    
    def sort(self, field, direction=1):
        self._sort_field = field
        self._sort_direction = 'ASC' if direction == 1 else 'DESC'
        return self
    
    async def to_list(self, max_size):
        async with self.pool.acquire() as conn:
            # Handle complex queries
            if '$or' in self.query:
                # Handle OR queries for messages between two users
                or_conditions = self.query['$or']
                conditions = []
                params = []
                idx = 1
                
                for cond in or_conditions:
                    cond_parts = []
                    for k, v in cond.items():
                        cond_parts.append(f"{k} = ${idx}")
                        params.append(v)
                        idx += 1
                    conditions.append(f"({' AND '.join(cond_parts)})")
                
                where_clause = ' OR '.join(conditions)
                sql = f"SELECT * FROM messages WHERE {where_clause}"
            elif 'to_user_id' in self.query and 'read' in self.query:
                sql = "SELECT * FROM messages WHERE to_user_id = $1 AND read = $2"
                params = [self.query['to_user_id'], self.query['read']]
            else:
                # Simple query
                parts = []
                params = []
                idx = 1
                for k, v in self.query.items():
                    parts.append(f"{k} = ${idx}")
                    params.append(v)
                    idx += 1
                
                if parts:
                    sql = f"SELECT * FROM messages WHERE {' AND '.join(parts)}"
                else:
                    sql = "SELECT * FROM messages"
            
            if self._sort_field:
                sql += f" ORDER BY {self._sort_field} {self._sort_direction}"
            
            if max_size and max_size > 0:
                sql += f" LIMIT {max_size}"
            
            rows = await conn.fetch(sql, *params) if params else await conn.fetch(sql)
            return [dict(row) for row in rows]


class PostgresFriendsCollection:
    def __init__(self, pool):
        self.pool = pool
    
    async def insert_one(self, doc: dict):
        async with self.pool.acquire() as conn:
            await conn.execute('''
                INSERT INTO friends (user_id, username, friend_id, friend_username, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            ''', doc['user_id'], doc['username'], doc['friend_id'], 
                doc['friend_username'], doc['status'], doc['created_at'])
        return {"inserted_id": "ok"}
    
    async def find_one(self, query: dict):
        async with self.pool.acquire() as conn:
            parts = []
            params = []
            idx = 1
            for k, v in query.items():
                parts.append(f"{k} = ${idx}")
                params.append(v)
                idx += 1
            
            if parts:
                sql = f"SELECT * FROM friends WHERE {' AND '.join(parts)} LIMIT 1"
                row = await conn.fetchrow(sql, *params)
                if row:
                    return dict(row)
        return None
    
    def find(self, query=None, projection=None):
        return PostgresFriendsCursor(self.pool, query or {})
    
    async def update_one(self, query: dict, update: dict):
        async with self.pool.acquire() as conn:
            if '$set' in update:
                set_clause = update['$set']
                # Build UPDATE query
                set_parts = []
                values = []
                idx = 1
                for k, v in set_clause.items():
                    set_parts.append(f"{k} = ${idx}")
                    values.append(v)
                    idx += 1
                
                where_parts = []
                for k, v in query.items():
                    where_parts.append(f"{k} = ${idx}")
                    values.append(v)
                    idx += 1
                
                sql = f"UPDATE friends SET {', '.join(set_parts)} WHERE {' AND '.join(where_parts)}"
                result = await conn.execute(sql, *values)
                count = int(result.split()[-1]) if result else 0
                return type('Result', (), {'modified_count': count})()
        return type('Result', (), {'modified_count': 0})()


class PostgresFriendsCursor:
    def __init__(self, pool, query):
        self.pool = pool
        self.query = query
    
    async def to_list(self, max_size):
        async with self.pool.acquire() as conn:
            parts = []
            params = []
            idx = 1
            for k, v in self.query.items():
                parts.append(f"{k} = ${idx}")
                params.append(v)
                idx += 1
            
            if parts:
                sql = f"SELECT * FROM friends WHERE {' AND '.join(parts)}"
            else:
                sql = "SELECT * FROM friends"
            
            if max_size and max_size > 0:
                sql += f" LIMIT {max_size}"
            
            rows = await conn.fetch(sql, *params) if params else await conn.fetch(sql)
            return [dict(row) for row in rows]
    
    def __aiter__(self):
        self._results = None
        return self
    
    async def __anext__(self):
        if self._results is None:
            self._results = await self.to_list(None)
            self._iter = iter(self._results)
        
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration
