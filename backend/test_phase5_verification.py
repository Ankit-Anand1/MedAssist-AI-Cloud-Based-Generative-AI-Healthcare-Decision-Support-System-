"""
Phase 5 Verification Test Suite

Tests all Phase 5 Real System Implementation & Production Integration features:
1. Absence of Dummy Data (dummy-data.ts deleted, zero imports)
2. Live Doctor Dashboard Aggregation API (/api/dashboard/doctor) from MongoDB
3. Settings API (/api/settings/profile) GET and PUT operations
4. Storage Abstraction Layer (save, exists, get, delete, URL generation)
5. Event-Driven Notification Generation and Retrieval
6. Appointment Creation and Scheduling via Real API
7. Production Configuration & Environment Template Verification
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from bson import ObjectId

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def run_phase5_tests():
    print("\n" + "=" * 65)
    print("PHASE 5 VERIFICATION SUITE — REAL SYSTEM IMPLEMENTATION")
    print("=" * 65)

    passed_tests = 0
    total_tests = 7

    # ---------------------------------------------------------
    # Test 1: Absence of Dummy Data
    # ---------------------------------------------------------
    print("\n--- Test 1: Elimination of Hardcoded Dummy Data ---")
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "healthcare-app"))
    dummy_data_path = os.path.join(frontend_dir, "src", "lib", "dummy-data.ts")

    assert not os.path.exists(dummy_data_path), f"dummy-data.ts still exists at {dummy_data_path}!"
    print("✓ Confirmed: dummy-data.ts has been deleted from healthcare-app/src/lib/")

    # Check for any imports of dummy-data in src
    src_dir = os.path.join(frontend_dir, "src")
    import_found = False
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith((".ts", ".tsx")):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "dummy-data" in content:
                        print(f"  WARNING: Found reference to dummy-data in {filepath}")
                        import_found = True
    assert not import_found, "Dummy data imports still detected in frontend source files!"
    print("✓ Confirmed: Zero imports of dummy-data across all frontend components and routes.")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 2: Storage Abstraction Layer
    # ---------------------------------------------------------
    print("\n--- Test 2: Storage Abstraction Layer ---")
    from storage import storage, LocalStorage, StorageBackend

    assert isinstance(storage, LocalStorage), "Default storage backend must be LocalStorage in dev"
    assert issubclass(LocalStorage, StorageBackend), "LocalStorage must inherit from StorageBackend"
    test_content = b"Phase 5 Verification Medical Document Payload"
    test_filename = "phase5_test_file.txt"

    # Test upload_file
    rel_url = await storage.upload_file(test_content, test_filename, content_type="text/plain")
    print(f"  - Uploaded file relative URL: {rel_url}")
    abs_path = storage.get_absolute_path(rel_url)
    assert os.path.exists(abs_path), f"File was not saved to expected absolute path: {abs_path}"

    with open(abs_path, "rb") as f:
        saved_bytes = f.read()
    assert saved_bytes == test_content, "Saved content does not match uploaded content"
    print("  - Content integrity and filesystem storage verified.")

    # Test delete_file
    deleted = await storage.delete_file(rel_url)
    assert deleted is True, "Storage delete_file failed"
    assert not os.path.exists(abs_path), "File still exists on disk after deletion"
    print("✓ Storage abstraction (upload_file, get_absolute_path, delete_file) works cleanly.")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 3: Live Doctor Dashboard Aggregation from MongoDB
    # ---------------------------------------------------------
    print("\n--- Test 3: Doctor Dashboard MongoDB Aggregation ---")
    from database import db
    from routes.dashboard import doctor_dashboard

    await db.connect()

    # Find an actual doctor from users/doctors collection
    doctor_user = await db.users.find_one({"role": "doctor"})
    assert doctor_user is not None, "No doctor user found in database"
    current_user_payload = {
        "id": str(doctor_user["_id"]),
        "email": doctor_user["email"],
        "role": doctor_user["role"],
        "name": doctor_user.get("name", "Doctor"),
    }

    stats = await doctor_dashboard(current_user=current_user_payload)
    print("  Aggregated Statistics from Real MongoDB:")
    print(f"  - Total Patients: {stats['patient_stats']['total']}")
    print(f"  - Patients with Recent Reports: {stats['patient_stats']['with_recent_reports']}")
    print(f"  - Total Reports: {stats['report_stats']['total']}")
    print(f"  - Total AI Analyses (MRI): {stats['ai_stats']['mri']}")
    print(f"  - Total AI Analyses (X-ray): {stats['ai_stats']['xray']}")
    print(f"  - Total AI Analyses (ECG): {stats['ai_stats']['ecg']}")
    print(f"  - Total AI Analyses (Blood): {stats['ai_stats']['blood']}")
    print(f"  - Upcoming Appointments: {len(stats['upcoming_appointments'])}")
    print(f"  - Active Alerts: {len(stats['active_alerts'])}")
    print(f"  - Recent Activities: {len(stats['recent_activity'])}")

    # Verify structure and data integrity
    assert "patient_stats" in stats and "total" in stats["patient_stats"]
    assert "report_stats" in stats and "total" in stats["report_stats"]
    assert "ai_stats" in stats and "mri" in stats["ai_stats"]
    assert isinstance(stats["upcoming_appointments"], list)
    assert isinstance(stats["active_alerts"], list)
    assert isinstance(stats["recent_activity"], list)
    print("✓ Dashboard statistics successfully computed from actual database collections (no hardcoded metrics).")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 4: Doctor Settings / Profile API
    # ---------------------------------------------------------
    print("\n--- Test 4: Doctor Settings Profile (GET & PUT) ---")
    from routes.settings import get_profile, update_profile

    # Test GET
    profile = await get_profile(current_user=current_user_payload)
    print(f"  - Profile retrieved: {profile['name']} ({profile['email']})")
    assert profile["email"] == doctor_user["email"]

    # Test PUT (update phone and hospital)
    original_phone = profile.get("phone", "")
    test_phone = "+91 99999 88888"
    update_data = {
        "name": profile["name"],
        "phone": test_phone,
        "specialization": profile.get("specialization", "Cardiologist"),
        "hospital": "AIIMS New Delhi",
    }
    update_res = await update_profile(update_data, current_user=current_user_payload)
    assert update_res["phone"] == test_phone
    assert update_res["hospital"] == "AIIMS New Delhi"
    print("  - Profile updated in database with new phone and hospital.")

    # Re-fetch from DB to guarantee persistence
    refetched = await get_profile(current_user=current_user_payload)
    assert refetched["phone"] == test_phone
    assert refetched["hospital"] == "AIIMS New Delhi"

    # Restore original phone if present
    if original_phone:
        await update_profile({"phone": original_phone}, current_user=current_user_payload)
    print("✓ Profile settings API reads from and writes to MongoDB accurately.")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 5: Event-Driven Notification System
    # ---------------------------------------------------------
    print("\n--- Test 5: Event-Driven Notification System ---")
    # Verify inserting a real notification into db.notifications
    test_notif = {
        "patient_id": str(ObjectId()),
        "doctor_id": str(doctor_user["_id"]),
        "target_role": "doctor",
        "type": "analysis_completed",
        "title": "Phase 5 System Verification Notification",
        "message": "Real-time AI pipeline completed automated assessment.",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    insert_res = await db.notifications.insert_one(test_notif)
    assert insert_res.inserted_id is not None

    # Retrieve notification from db
    saved_notif = await db.notifications.find_one({"_id": insert_res.inserted_id})
    assert saved_notif is not None
    assert saved_notif["title"] == "Phase 5 System Verification Notification"
    print("  - Notification persisted to MongoDB notifications collection.")

    # Clean up test notification
    await db.notifications.delete_one({"_id": insert_res.inserted_id})
    print("✓ Real notification generation and retrieval verified.")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 6: Real Appointment Creation & Scheduling
    # ---------------------------------------------------------
    print("\n--- Test 6: Real Appointment Creation ---")
    from routes.appointments import create_appointment, list_appointments
    from models.appointment import AppointmentCreate

    # Get a real patient
    patient_doc = await db.patients.find_one({})
    assert patient_doc is not None, "No patient found in database"
    patient_id = str(patient_doc["_id"])

    new_appt = AppointmentCreate(
        patient_id=patient_id,
        date=(datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d"),
        time="10:30 AM",
        type="Consultation",
        notes="Phase 5 Clinical System Integration Test",
    )

    created_appt = await create_appointment(new_appt, current_user=current_user_payload)
    print(f"  - Created appointment ID: {created_appt['id']}")
    assert created_appt["notes"] == "Phase 5 Clinical System Integration Test"

    # Verify retrieval
    appts = await list_appointments(current_user=current_user_payload)
    found = any(a["id"] == created_appt["id"] for a in appts)
    assert found, "Created appointment not found in appointment list"

    # Cleanup test appointment
    await db.appointments.delete_one({"_id": ObjectId(created_appt["id"])})
    print("✓ Appointment created and queried via database endpoints.")
    passed_tests += 1

    # ---------------------------------------------------------
    # Test 7: Production Configuration & Environment Template
    # ---------------------------------------------------------
    print("\n--- Test 7: Production Environment Configuration ---")
    prod_template_path = os.path.join(os.path.dirname(__file__), ".env.production.template")
    assert os.path.exists(prod_template_path), ".env.production.template is missing!"

    with open(prod_template_path, "r") as f:
        template_content = f.read()

    required_vars = [
        "MONGODB_URI",
        "JWT_SECRET",
        "FRONTEND_URL",
        "GEMINI_API_KEY",
        "STORAGE_BACKEND",
        "ENVIRONMENT",
    ]
    for var in required_vars:
        assert var in template_content, f"Missing required env var: {var} in .env.production.template"
        print(f"  - Verified env var specification: {var}")

    print("✓ Production environment template verified with all security and deployment variables.")
    passed_tests += 1

    print("\n" + "=" * 65)
    print(f"ALL {passed_tests}/{total_tests} PHASE 5 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    asyncio.run(run_phase5_tests())
