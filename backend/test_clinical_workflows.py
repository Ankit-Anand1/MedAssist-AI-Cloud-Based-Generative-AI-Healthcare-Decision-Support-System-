import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 60)
    print("RUNNING END-TO-END CLINICAL WORKFLOW VERIFICATION")
    print("=" * 60)

    # 1. Login as patient
    patient_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "rajesh.kumar@email.com",
        "password": "password123"
    })
    if patient_res.status_code != 200:
        print(f"FAILED: Patient login failed: {patient_res.text}")
        sys.exit(1)
    patient_token = patient_res.json().get("access_token") or patient_res.json().get("token")
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    print("✓ Patient login successful")

    # 2. Login as doctor
    doctor_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dr.priya@medcare.in",
        "password": "password123"
    })
    if doctor_res.status_code != 200:
        print(f"FAILED: Doctor login failed: {doctor_res.text}")
        sys.exit(1)
    doctor_token = doctor_res.json().get("access_token") or doctor_res.json().get("token")
    doctor_headers = {"Authorization": f"Bearer {doctor_token}"}
    print("✓ Doctor login successful")

    # 3. Test Patient Profile Update (PUT /api/patients/me)
    profile_update = {
        "name": "Rajesh Kumar",
        "age": 52,
        "gender": "Male",
        "blood_group": "B+",
        "phone": "+91 98765 43210",
        "address": "42 Park Avenue, Indiranagar, Bengaluru",
        "emergency_contact": "Sunita Kumar (+91 98765 43211)",
    }
    update_res = requests.put(f"{BASE_URL}/api/patients/me", json=profile_update, headers=patient_headers)
    if update_res.status_code != 200:
        print(f"FAILED: Patient PUT /api/patients/me failed: {update_res.text}")
        sys.exit(1)
    updated_profile = update_res.json()
    assert updated_profile["name"] == "Rajesh Kumar"
    assert updated_profile["age"] == 52
    assert updated_profile["blood_group"] == "B+"
    print(f"✓ Patient Profile Update passed: {updated_profile['name']}, Age {updated_profile['age']}, Blood {updated_profile['blood_group']}")

    patient_id = updated_profile["id"]

    # 4. Test Doctor Updating Patient Vitals (POST /api/patients/{id}/vitals)
    vitals_payload = {
        "blood_pressure": "126/82",
        "heart_rate": 74,
        "oxygen_saturation": 98.5,
        "glucose": 108.0,
        "temperature": 98.6,
        "weight": 72.0,
        "bmi": 23.8,
        "notes": "Patient well-controlled on morning metformin and amlodipine"
    }
    vitals_res = requests.post(f"{BASE_URL}/api/patients/{patient_id}/vitals", json=vitals_payload, headers=doctor_headers)
    if vitals_res.status_code != 200:
        print(f"FAILED: Doctor vitals update failed: {vitals_res.text}")
        sys.exit(1)
    vital_data = vitals_res.json()
    assert vital_data["blood_pressure"] == "126/82"
    assert vital_data["heart_rate"] == 74
    print(f"✓ Doctor Vitals Recording passed: BP {vital_data['blood_pressure']}, HR {vital_data['heart_rate']} bpm, SpO2 {vital_data['oxygen_saturation']}%")

    # 5. Test Doctor Updating Patient Clinical Data & Drug Allergies (PUT /api/patients/{id}/clinical)
    clinical_payload = {
        "allergies": ["Peanuts", "Dust Mites"],
        "drug_allergies": ["Penicillin", "Sulfa drugs"],
        "conditions": ["Type 2 Diabetes", "Essential Hypertension", "Mild Cognitive Impairment"],
        "next_appointment": "2026-11-25"
    }
    clinical_res = requests.put(f"{BASE_URL}/api/patients/{patient_id}/clinical", json=clinical_payload, headers=doctor_headers)
    if clinical_res.status_code != 200:
        print(f"FAILED: Doctor clinical update failed: {clinical_res.text}")
        sys.exit(1)
    clinical_data = clinical_res.json()
    assert "Penicillin" in clinical_data.get("drug_allergies", [])
    assert clinical_data.get("next_appointment") == "2026-11-25"
    print(f"✓ Doctor Clinical & Drug Allergies Update passed: Drug Allergies: {clinical_data['drug_allergies']}")

    # 6. Test Bidirectional Appointment Booking (POST /api/appointments)
    apt_payload = {
        "patient_id": "",
        "date": "2026-11-28",
        "time": "10:30 AM",
        "type": "Consultation",
        "notes": "Scheduled via patient portal for follow-up review"
    }
    apt_res = requests.post(f"{BASE_URL}/api/appointments", json=apt_payload, headers=patient_headers)
    if apt_res.status_code != 200:
        print(f"FAILED: Patient appointment booking failed: {apt_res.text}")
        sys.exit(1)
    apt_data = apt_res.json()
    assert apt_data["status"] == "Scheduled"
    print(f"✓ Patient Appointment Booking passed: ID {apt_data['id']} with {apt_data.get('doctor_name')} on {apt_data['date']}")

    # Verify doctor can list this appointment
    doc_apts_res = requests.get(f"{BASE_URL}/api/appointments", headers=doctor_headers)
    if doc_apts_res.status_code != 200:
        print(f"FAILED: Doctor appointments list failed: {doc_apts_res.text}")
        sys.exit(1)
    doc_apts = doc_apts_res.json()
    assert any(a["id"] == apt_data["id"] for a in doc_apts)
    print(f"✓ Doctor Appointment Sync passed: {len(doc_apts)} appointments found in doctor schedule")

    # 7. Test Dynamic PDF Generation (GET /api/ai/brief/{patient_id}/pdf)
    pdf_res = requests.get(f"{BASE_URL}/api/ai/brief/{patient_id}/pdf", headers=patient_headers)
    if pdf_res.status_code != 200:
        print(f"FAILED: PDF download failed: {pdf_res.status_code} {pdf_res.text}")
        sys.exit(1)
    pdf_content = pdf_res.content
    assert pdf_content.startswith(b"%PDF"), "Response is not a valid PDF file"
    assert len(pdf_content) > 10000, f"PDF file size is suspiciously small ({len(pdf_content)} bytes)"
    print(f"✓ Dynamic PDF Generation passed: Size {len(pdf_content)} bytes with Content-Type application/pdf")

    # Also test doctor downloading the PDF
    doc_pdf_res = requests.get(f"{BASE_URL}/api/ai/brief/{patient_id}/pdf", headers=doctor_headers)
    assert doc_pdf_res.status_code == 200
    assert doc_pdf_res.content.startswith(b"%PDF")
    print(f"✓ Doctor PDF Access passed: Size {len(doc_pdf_res.content)} bytes")

    print("\n" + "=" * 60)
    print("ALL 6 CLINICAL WORKFLOW REQUIREMENTS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
