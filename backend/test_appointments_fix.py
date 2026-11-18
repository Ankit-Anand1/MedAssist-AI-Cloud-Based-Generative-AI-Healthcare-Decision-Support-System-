import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_appointments():
    print("=" * 60)
    print("VERIFYING DOCTOR APPOINTMENTS & DASHBOARD SYNC")
    print("=" * 60)

    # 1. Login as Dr. Priya Sharma (seeded)
    doc_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dr.priya@medcare.in",
        "password": "password123"
    })
    if doc_res.status_code != 200:
        print(f"FAILED: Doctor login failed: {doc_res.text}")
        sys.exit(1)
    doc_token = doc_res.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("✓ Logged in as Dr. Priya Sharma (dr.priya@medcare.in)")

    # 2. Call GET /api/appointments
    apts_res = requests.get(f"{BASE_URL}/api/appointments", headers=doc_headers)
    if apts_res.status_code != 200:
        print(f"FAILED: GET /api/appointments failed: {apts_res.text}")
        sys.exit(1)
    apts = apts_res.json()
    print(f"✓ GET /api/appointments returned {len(apts)} total appointments")

    # Find Pradyot's appointment
    pradyot_apts = [a for a in apts if "pradyot" in (a.get("patient_name") or "").lower()]
    print(f"✓ Found {len(pradyot_apts)} appointment(s) for Pradyot:")
    for a in pradyot_apts:
        print(f"   - Patient: {a.get('patient_name')}, Date: {a.get('date')}, Time: {a.get('time')}, Status: {a.get('status')}, Notes: {a.get('notes')}")

    assert any(a.get("date") == "2026-11-03" and "pneumonia" in (a.get("notes") or "").lower() for a in pradyot_apts), \
        "Pradyot's Nov 3, 2026 pneumonia appointment was NOT found in doctor's appointments list!"
    print("✓ Pradyot's Nov 3, 2026 pneumonia appointment successfully found in GET /api/appointments!")

    # 3. Call GET /api/dashboard/doctor
    dash_res = requests.get(f"{BASE_URL}/api/dashboard/doctor", headers=doc_headers)
    if dash_res.status_code != 200:
        print(f"FAILED: GET /api/dashboard/doctor failed: {dash_res.text}")
        sys.exit(1)
    dash_data = dash_res.json()
    upcoming = dash_data.get("upcoming_appointments", [])
    print(f"✓ GET /api/dashboard/doctor returned {len(upcoming)} upcoming appointments")
    for u in upcoming:
        print(f"   - Patient: {u.get('patient_name')}, Date: {u.get('date')}, Time: {u.get('time')}, Notes: {u.get('notes')}")

    pradyot_in_dash = [u for u in upcoming if "pradyot" in (u.get("patient_name") or "").lower()]
    assert len(pradyot_in_dash) > 0, "Pradyot's appointment was NOT found in doctor dashboard upcoming_appointments!"
    assert any(u.get("date") == "2026-11-03" and "pneumonia" in (u.get("notes") or "").lower() for u in pradyot_in_dash), \
        "Pradyot's Nov 3, 2026 pneumonia appointment missing in doctor dashboard!"
    print("✓ Pradyot's Nov 3, 2026 pneumonia appointment successfully verified in GET /api/dashboard/doctor!")

    # 4. Also verify secondary Dr. Priya account (priya@doctor.org) if it exists
    doc2_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "priya@doctor.org",
        "password": "password123"
    })
    if doc2_res.status_code == 200:
        doc2_token = doc2_res.json()["access_token"]
        doc2_headers = {"Authorization": f"Bearer {doc2_token}"}
        dash2_res = requests.get(f"{BASE_URL}/api/dashboard/doctor", headers=doc2_headers)
        if dash2_res.status_code == 200:
            upcoming2 = dash2_res.json().get("upcoming_appointments", [])
            has_pradyot = any("pradyot" in (u.get("patient_name") or "").lower() for u in upcoming2)
            print(f"✓ Secondary Dr. Priya account (priya@doctor.org) dashboard check: {len(upcoming2)} upcoming, has Pradyot: {has_pradyot}")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! APPOINTMENTS SYNC WORKING PERFECTLY.")
    print("=" * 60)

if __name__ == "__main__":
    test_appointments()

