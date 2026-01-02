
from datetime import datetime, timezone
import asyncio

class InMemoryCollection:
    def __init__(self, data=None):
        self.data = data if data is not None else []

    async def find_one(self, query):
        for doc in self.data:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc
        return None

    async def insert_one(self, document):
        # deep copy if needed, but simple dict is fine for now
        self.data.append(document)
        return True

    def find(self, query, projection=None):
        # Returns a cursor-like object
        return InMemoryCursor(self.data, query, projection)

    async def update_one(self, query, update):
        doc = await self.find_one(query)
        if doc:
            # Handle $set
            if "$set" in update:
                for k, v in update["$set"].items():
                    doc[k] = v
            return MockResult(modified_count=1)
        return MockResult(modified_count=0)

class MockResult:
    def __init__(self, modified_count):
        self.modified_count = modified_count

class InMemoryCursor:
    def __init__(self, data, query, projection=None):
        self.raw_data = data
        self.query = query
        self.projection = projection
        self.sort_key = None
        self.sort_order = 1
        self._filtered_data = None
        self._iter_index = 0

    def sort(self, key, order=1):
        self.sort_key = key
        self.sort_order = order
        return self

    def _get_filtered_data(self):
        if self._filtered_data is not None:
            return self._filtered_data
            
        filtered = []
        for doc in self.raw_data:
            match = True
            if "$or" in self.query:
                # specific handling for the messages query
                # {"$or": [{"from": a, "to": b}, ...]}
                or_match = False
                for cond in self.query["$or"]:
                    sub_match = True
                    for k, v in cond.items():
                        if doc.get(k) != v:
                            sub_match = False
                            break
                    if sub_match:
                        or_match = True
                        break
                if not or_match:
                    match = False
            else:
                for k, v in self.query.items():
                    if doc.get(k) != v:
                        match = False
                        break
            
            if match:
                filtered.append(doc)

        if self.sort_key:
            filtered.sort(key=lambda x: x.get(self.sort_key, ""), reverse=(self.sort_order == -1))
        
        self._filtered_data = filtered
        return filtered

    async def to_list(self, length):
        data = self._get_filtered_data()
        return data[:length]

    def __aiter__(self):
        self._get_filtered_data() # Ensure data is prepared
        self._iter_index = 0
        return self

    async def __anext__(self):
        if self._iter_index < len(self._filtered_data):
            doc = self._filtered_data[self._iter_index]
            self._iter_index += 1
            return doc
        else:
            raise StopAsyncIteration

class InMemoryDB:
    def __init__(self):
        self.users = InMemoryCollection()
        self.messages = InMemoryCollection()
        self.friends = InMemoryCollection()

    def __getitem__(self, item):
        return getattr(self, item)
