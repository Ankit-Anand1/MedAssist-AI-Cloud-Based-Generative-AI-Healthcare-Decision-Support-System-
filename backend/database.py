"""
Database connection module with automatic persistent fallback.

Tries connecting to local MongoDB first (with a 2-second timeout).
If MongoDB is unavailable, automatically falls back to mongomock-motor
backed by a disk persistence store (JSON) so that user accounts, profiles,
vitals, and appointments persist permanently across server restarts.
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

logger = logging.getLogger("database")

_USE_MOCK = False

MOCK_STORE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "data", "mock_db_store.json"
)

COLLECTIONS_TO_PERSIST = [
    "users", "patients", "doctors", "reports", "prescriptions",
    "appointments", "doctor_notes", "medical_history", "ai_analysis",
    "lab_values", "vital_signs", "research_evidence", "ai_patient_briefs",
    "notifications", "copilot_sessions"
]


def _json_serialize_doc(doc: dict) -> dict:
    """Recursively convert BSON/MongoDB objects into JSON-safe dictionaries."""
    serialized = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            serialized[k] = {"$oid": str(v)}
        elif isinstance(v, datetime):
            serialized[k] = {"$date": v.isoformat()}
        elif isinstance(v, list):
            new_list = []
            for item in v:
                if isinstance(item, ObjectId):
                    new_list.append({"$oid": str(item)})
                elif isinstance(item, datetime):
                    new_list.append({"$date": item.isoformat()})
                elif isinstance(item, dict):
                    new_list.append(_json_serialize_doc(item))
                else:
                    new_list.append(item)
            serialized[k] = new_list
        elif isinstance(v, dict):
            serialized[k] = _json_serialize_doc(v)
        else:
            serialized[k] = v
    return serialized


def _json_deserialize_doc(doc: dict) -> dict:
    """Recursively convert JSON storage back into BSON/MongoDB-compatible types."""
    deserialized = {}
    for k, v in doc.items():
        if isinstance(v, dict) and "$oid" in v:
            try:
                deserialized[k] = ObjectId(v["$oid"])
            except Exception:
                deserialized[k] = v["$oid"]
        elif isinstance(v, dict) and "$date" in v:
            try:
                deserialized[k] = datetime.fromisoformat(v["$date"])
            except Exception:
                deserialized[k] = v["$date"]
        elif isinstance(v, list):
            new_list = []
            for item in v:
                if isinstance(item, dict) and "$oid" in item:
                    try:
                        new_list.append(ObjectId(item["$oid"]))
                    except Exception:
                        new_list.append(item["$oid"])
                elif isinstance(item, dict) and "$date" in item:
                    try:
                        new_list.append(datetime.fromisoformat(item["$date"]))
                    except Exception:
                        new_list.append(item["$date"])
                elif isinstance(item, dict):
                    new_list.append(_json_deserialize_doc(item))
                else:
                    new_list.append(item)
            deserialized[k] = new_list
        elif isinstance(v, dict):
            deserialized[k] = _json_deserialize_doc(v)
        else:
            deserialized[k] = v
    return deserialized


async def _can_connect_mongo(uri: str, timeout_seconds: float = 2.0) -> bool:
    """Try to ping real MongoDB within timeout. Returns True if reachable."""
    try:
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=int(timeout_seconds * 1000))
        await asyncio.wait_for(
            client.admin.command("ping"),
            timeout=timeout_seconds,
        )
        client.close()
        return True
    except Exception:
        return False


class Database:
    """Database accessor with automatic mock fallback and file persistence."""

    def __init__(self):
        self._client = None
        self._db = None
        self._is_mock = False

    async def connect(self):
        global _USE_MOCK

        # Try real MongoDB first
        if await _can_connect_mongo(settings.MONGODB_URI):
            self._client = AsyncIOMotorClient(settings.MONGODB_URI)
            self._db = self._client[settings.DB_NAME]
            self._is_mock = False
            logger.info("✓ Connected to real MongoDB: %s", settings.MONGODB_URI)
        else:
            # Fallback to mongomock-motor with disk-backed store
            from mongomock_motor import AsyncMongoMockClient
            self._client = AsyncMongoMockClient()
            self._db = self._client[settings.DB_NAME]
            self._is_mock = True
            _USE_MOCK = True
            logger.warning(
                "⚠ MongoDB unavailable at %s — using persistent mock database",
                settings.MONGODB_URI,
            )
            await self.load_mock_store()

    async def close(self):
        if self._is_mock:
            await self.persist_mock()
        elif self._client:
            self._client.close()

    async def load_mock_store(self):
        """Load persisted mock collections from disk if file exists."""
        if not self._is_mock:
            return
        if not os.path.exists(MOCK_STORE_FILE):
            return
        try:
            with open(MOCK_STORE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for coll_name, docs in data.items():
                if docs:
                    coll = self._database[coll_name]
                    clean_docs = [_json_deserialize_doc(d) for d in docs]
                    if clean_docs:
                        await coll.delete_many({})
                        await coll.insert_many(clean_docs)
            logger.info("✓ Loaded persisted mock store from %s", MOCK_STORE_FILE)
        except Exception as e:
            logger.warning("Could not load mock store: %s", e)

    async def persist_mock(self):
        """Save current mock collections to disk for persistence across restarts."""
        if not self._is_mock:
            return
        try:
            os.makedirs(os.path.dirname(MOCK_STORE_FILE), exist_ok=True)
            store = {}
            for coll_name in COLLECTIONS_TO_PERSIST:
                cursor = self._database[coll_name].find({})
                docs = []
                async for d in cursor:
                    docs.append(_json_serialize_doc(dict(d)))
                store[coll_name] = docs

            with open(MOCK_STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(store, f, indent=2)
            logger.debug("✓ Persisted mock DB to %s", MOCK_STORE_FILE)
        except Exception as e:
            logger.warning("Could not persist mock DB: %s", e)

    @property
    def is_mock(self) -> bool:
        return self._is_mock

    @property
    def _database(self):
        if self._db is None:
            from mongomock_motor import AsyncMongoMockClient
            self._client = AsyncMongoMockClient()
            self._db = self._client[settings.DB_NAME]
            self._is_mock = True
        return self._db

    @property
    def users(self):
        return self._database["users"]

    @property
    def patients(self):
        return self._database["patients"]

    @property
    def doctors(self):
        return self._database["doctors"]

    @property
    def reports(self):
        return self._database["reports"]

    @property
    def prescriptions(self):
        return self._database["prescriptions"]

    @property
    def appointments(self):
        return self._database["appointments"]

    @property
    def doctor_notes(self):
        return self._database["doctor_notes"]

    @property
    def medical_history(self):
        return self._database["medical_history"]

    @property
    def ai_analysis(self):
        return self._database["ai_analysis"]

    @property
    def lab_values(self):
        return self._database["lab_values"]

    @property
    def vital_signs(self):
        return self._database["vital_signs"]

    @property
    def research_evidence(self):
        return self._database["research_evidence"]

    @property
    def ai_patient_briefs(self):
        return self._database["ai_patient_briefs"]

    @property
    def notifications(self):
        return self._database["notifications"]

    @property
    def ai_briefs_generated(self):
        return self._database["ai_briefs_generated"]

    @property
    def copilot_sessions(self):
        return self._database["copilot_sessions"]


db = Database()
