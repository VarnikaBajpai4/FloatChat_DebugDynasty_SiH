import asyncpg
import asyncio
from typing import List, Dict
import os
from dotenv import load_dotenv

load_dotenv()

class PostgresDB:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.pool = None

    async def connect(self, retries: int = 5, delay: int = 3):
        """Connect to PostgreSQL with retries."""
        for attempt in range(1, retries + 1):
            try:
                print(f"[DB] Attempt {attempt} to connect to database...")
                self.pool = await asyncpg.create_pool(dsn=self.dsn)
                print("[DB] Connected successfully!")
                return
            except Exception as e:
                print(f"[DB] Connection failed: {e}")
                if attempt < retries:
                    print(f"[DB] Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                else:
                    print("[DB] All connection attempts failed.")
                    raise

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            print("[DB] Connection closed.")

    async def fetch(self, query: str) -> List[Dict]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query)
            return [dict(row) for row in rows]


postgres_db = PostgresDB(dsn=os.getenv("postgres_link"))
