"""
Database Purification / Reset Script.

Safely purges development, demo, and test fixture records from MongoDB.
Requires explicit developer confirmation to prevent accidental data loss.

Usage:
    python scripts/reset_demo_database.py
    python scripts/reset_demo_database.py --confirm
"""

import sys
import os
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db
from config import settings


COLLECTIONS = [
    "users",
    "patients",
    "doctors",
    "reports",
    "prescriptions",
    "appointments",
    "doctor_notes",
    "medical_history",
    "ai_analysis",
    "lab_values",
    "vital_signs",
    "research_evidence",
    "ai_patient_briefs",
    "ai_briefs_generated",
    "copilot_sessions",
    "notifications",
]


async def reset_database():
    print("\n" + "=" * 70)
    print("DATABASE PURIFICATION — REMOVE DEMO & TEST FIXTURES")
    print("=" * 70)
    print(f"Target Database: {settings.DB_NAME} at {settings.MONGODB_URI}")
    print("\n⚠️  WARNING: This will permanently delete development/demo/test records.")
    print("All collections will be reset to an empty production state.\n")

    if "--confirm" not in sys.argv:
        try:
            val = input("Type 'yes' to proceed with permanent deletion: ").strip()
            if val != "yes":
                print("Operation cancelled by user.")
                sys.exit(0)
        except EOFError:
            print("Non-interactive session detected without --confirm flag. Aborted.")
            sys.exit(1)

    print("\nPurging collections...")
    await db.connect()

    total_deleted = 0
    for coll_name in COLLECTIONS:
        coll = db._database[coll_name]
        count_before = await coll.count_documents({})
        if count_before > 0:
            res = await coll.delete_many({})
            print(f"  - {coll_name}: deleted {res.deleted_count} records")
            total_deleted += res.deleted_count
        else:
            print(f"  - {coll_name}: already empty (0 records)")

    print("\n" + "=" * 70)
    print(f"✅ PURIFICATION COMPLETE: Deleted {total_deleted} total fixture records.")
    print("Database is now clean and ready for real production application workflows.")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(reset_database())
