"""
═══════════════════════════════════════════════════════════════════
DEVELOPMENT / TESTING ONLY — Database Seed Script

This script populates MongoDB with sample patient, report, and
appointment data for local development and testing purposes.

DO NOT run this in production. Production data comes exclusively
from real user interactions through the application UI and API.

Usage:  python seed.py
═══════════════════════════════════════════════════════════════════
"""
import os
import asyncio
from pathlib import Path
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    from database import db as _db
    # Ensure connection (with mock fallback if MongoDB is down)
    if _db._db is None:
        await _db.connect()
    client = _db._client
    db = _db._database

    # Clear all collections
    for coll in [
        "users", "patients", "doctors", "reports", "prescriptions",
        "appointments", "doctor_notes", "medical_history", "ai_analysis",
        "lab_values", "vital_signs", "research_evidence", "ai_patient_briefs",
        "notifications",
    ]:
        await db[coll].delete_many({})
    print("✓ Cleared all collections")

    # ── Users ──
    patient_user = await db.users.insert_one({
        "email": "rajesh.kumar@email.com",
        "name": "Rajesh Kumar",
        "role": "patient",
        "password_hash": pwd_context.hash("password123"),
    })
    patient_user_id = str(patient_user.inserted_id)

    doctor_user = await db.users.insert_one({
        "email": "dr.priya@medcare.in",
        "name": "Dr. Priya Sharma",
        "role": "doctor",
        "password_hash": pwd_context.hash("password123"),
    })
    doctor_user_id = str(doctor_user.inserted_id)

    # Create additional patient users
    patient_users = {}
    extra_patients_data = [
        ("anita.desai@email.com", "Anita Desai"),
        ("suresh.patel@email.com", "Suresh Patel"),
        ("meera.joshi@email.com", "Meera Joshi"),
        ("amit.singh@email.com", "Amit Singh"),
        ("lakshmi.nair@email.com", "Lakshmi Nair"),
    ]
    for email, name in extra_patients_data:
        r = await db.users.insert_one({
            "email": email, "name": name, "role": "patient",
            "password_hash": pwd_context.hash("password123"),
        })
        patient_users[email] = str(r.inserted_id)

    print(f"✓ Created {2 + len(extra_patients_data)} users")

    # ── Patient Profiles ──
    patients_data = [
        {
            "user_id": patient_user_id,
            "name": "Rajesh Kumar", "age": 45, "gender": "Male", "blood_group": "B+",
            "phone": "+91 99876 54321", "email": "rajesh.kumar@email.com",
            "address": "42 MG Road, Sector 15, Noida, UP 201301",
            "emergency_contact": "+91 98765 12345 (Wife - Sunita Kumar)",
            "allergies": ["Penicillin", "Sulfa drugs"],
            "conditions": ["Type 2 Diabetes", "Hypertension", "Mild Cognitive Impairment"],
            "avatar": "", "last_visit": "2026-08-28", "next_appointment": "2026-09-12",
            "status": "Follow-up Due",
        },
        {
            "user_id": patient_users["anita.desai@email.com"],
            "name": "Anita Desai", "age": 38, "gender": "Female", "blood_group": "O+",
            "phone": "+91 98123 45678", "email": "anita.desai@email.com",
            "address": "15 Park Avenue, Bandra, Mumbai 400050",
            "emergency_contact": "+91 97654 32100 (Husband - Vikram Desai)",
            "allergies": ["Ibuprofen"], "conditions": ["Migraine", "Anxiety Disorder"],
            "avatar": "", "last_visit": "2026-09-02", "next_appointment": "2026-09-15",
            "status": "Active",
        },
        {
            "user_id": patient_users["suresh.patel@email.com"],
            "name": "Suresh Patel", "age": 62, "gender": "Male", "blood_group": "A+",
            "phone": "+91 99887 76655", "email": "suresh.patel@email.com",
            "address": "78 Nehru Nagar, Ahmedabad 380015",
            "emergency_contact": "+91 98765 00123 (Son - Karan Patel)",
            "allergies": [], "conditions": ["Coronary Artery Disease", "Hyperlipidemia", "Osteoarthritis"],
            "avatar": "", "last_visit": "2026-08-25", "next_appointment": "2026-09-10",
            "status": "Follow-up Due",
        },
        {
            "user_id": patient_users["meera.joshi@email.com"],
            "name": "Meera Joshi", "age": 29, "gender": "Female", "blood_group": "AB+",
            "phone": "+91 97654 33211", "email": "meera.joshi@email.com",
            "address": "23 Civil Lines, Jaipur 302006",
            "emergency_contact": "+91 98765 44556 (Father - Ramesh Joshi)",
            "allergies": ["Aspirin"], "conditions": ["Epilepsy"],
            "avatar": "", "last_visit": "2026-09-01", "next_appointment": "2026-09-20",
            "status": "Stable",
        },
        {
            "user_id": patient_users["amit.singh@email.com"],
            "name": "Amit Singh", "age": 55, "gender": "Male", "blood_group": "B-",
            "phone": "+91 98899 77665", "email": "amit.singh@email.com",
            "address": "56 Rajpur Road, Dehradun 248001",
            "emergency_contact": "+91 99876 11223 (Wife - Kavita Singh)",
            "allergies": ["Codeine"], "conditions": ["Chronic Kidney Disease", "Hypertension", "Anemia"],
            "avatar": "", "last_visit": "2026-08-30", "next_appointment": "2026-09-08",
            "status": "Follow-up Due",
        },
        {
            "user_id": patient_users["lakshmi.nair@email.com"],
            "name": "Lakshmi Nair", "age": 50, "gender": "Female", "blood_group": "O-",
            "phone": "+91 94432 21100", "email": "lakshmi.nair@email.com",
            "address": "12 MG Road, Kochi 682016",
            "emergency_contact": "+91 98765 99887 (Daughter - Divya Nair)",
            "allergies": [], "conditions": ["Rheumatoid Arthritis", "Hypothyroidism"],
            "avatar": "", "last_visit": "2026-08-20", "next_appointment": "2026-09-18",
            "status": "Stable",
        },
    ]

    patient_ids = {}
    for p in patients_data:
        result = await db.patients.insert_one(p)
        patient_ids[p["name"]] = str(result.inserted_id)

    print(f"✓ Created {len(patients_data)} patient profiles")

    # ── Doctor Profile ──
    doctor_result = await db.doctors.insert_one({
        "user_id": doctor_user_id,
        "name": "Dr. Priya Sharma",
        "specialization": "Neurologist",
        "qualification": "MBBS, MD (Neurology), DM",
        "phone": "+91 98765 43210",
        "email": "dr.priya@medcare.in",
        "avatar": "",
        "experience": 12,
        "hospital": "MedCare Multi-Specialty Hospital",
        "assigned_patients": list(patient_ids.values()),
    })
    doctor_profile_id = str(doctor_result.inserted_id)
    print("✓ Created doctor profile")

    # ── Medical Reports ──
    p1 = patient_ids["Rajesh Kumar"]
    p2 = patient_ids["Anita Desai"]
    p3 = patient_ids["Suresh Patel"]
    p5 = patient_ids["Amit Singh"]

    reports_data = [
        {
            "patient_id": p1, "type": "Brain MRI", "title": "[DEMO/SAMPLE] Brain MRI - Routine Follow-up",
            "date": "2026-09-01", "status": "AI Analyzed", "ai_confidence": None, "findings": [],
            "summary": None, "urgency": "Normal", "processing_status": "Ready for Analysis",
            "file_url": "/uploads/sample_brain_mri.png", "file_name": "sample_brain_mri.png", "is_demo": True
        },
        {
            "patient_id": p1, "type": "X-ray", "title": "[DEMO/SAMPLE] Chest X-ray - Annual Screening",
            "date": "2026-08-28", "status": "AI Analyzed", "ai_confidence": None, "findings": [],
            "summary": None, "doctor_notes": "Normal findings on screening. Continue current management.",
            "urgency": "Normal", "processing_status": "Ready for Analysis",
            "file_url": "/uploads/sample_chest_xray.png", "file_name": "sample_chest_xray.png", "is_demo": True
        },
        {
            "patient_id": p1, "type": "ECG", "title": "[DEMO/SAMPLE] 12-Lead ECG - Cardiac Assessment",
            "date": "2026-08-28", "status": "AI Analyzed", "ai_confidence": None, "findings": [],
            "summary": None, "urgency": "Normal", "processing_status": "Ready for Analysis",
            "file_url": "/uploads/sample_ecg.png", "file_name": "sample_ecg.png", "is_demo": True
        },
        {
            "patient_id": p1, "type": "Blood Test", "title": "[DEMO/SAMPLE] Complete Blood Panel",
            "date": "2026-09-01", "status": "AI Analyzed", "ai_confidence": None, "findings": [],
            "summary": None, "urgency": "Moderate", "processing_status": "Ready for Analysis",
            "file_url": "/uploads/sample_blood_report.pdf", "file_name": "sample_blood_report.pdf", "is_demo": True
        },
        {
            "patient_id": p1, "type": "Medical Report", "title": "[DEMO/SAMPLE] Neurology Consultation Summary",
            "date": "2026-08-15", "status": "Reviewed", "ai_confidence": 90.0,
            "findings": ["MMSE score 24/30", "Mild memory impairment noted", "No focal neurological deficits"],
            "summary": "Patient shows signs of mild cognitive impairment. Recommend cognitive rehabilitation and follow-up in 3 months.",
            "doctor_notes": "Referred for neuropsychological testing. Started on donepezil 5mg.",
            "urgency": "Moderate", "processing_status": "Ready for Analysis",
            "file_url": "/uploads/sample_blood_report.pdf", "file_name": "sample_neuro_consult.pdf", "is_demo": True
        },
        {
            "patient_id": p2, "type": "Brain MRI", "title": "[DEMO/SAMPLE] Brain MRI - Migraine Evaluation",
            "date": "2026-09-02", "status": "Pending", "ai_confidence": None, "findings": [],
            "summary": "Report pending physician review.", "urgency": "Normal", "processing_status": "Pending Review",
            "file_url": "/uploads/sample_brain_mri.png", "file_name": "sample_brain_mri.png", "is_demo": True
        },
        {
            "patient_id": p3, "type": "ECG", "title": "[DEMO/SAMPLE] 12-Lead ECG - Chest Pain Evaluation",
            "date": "2026-08-25", "status": "Pending", "ai_confidence": None, "findings": [],
            "summary": "Report pending physician review.", "urgency": "High", "processing_status": "Pending Review",
            "file_url": "/uploads/sample_ecg.png", "file_name": "sample_ecg.png", "is_demo": True
        },
        {
            "patient_id": p5, "type": "Blood Test", "title": "[DEMO/SAMPLE] Renal Function Panel",
            "date": "2026-08-30", "status": "Pending", "ai_confidence": None, "findings": [],
            "summary": "Report pending physician review.", "urgency": "High", "processing_status": "Pending Review",
            "file_url": "/uploads/sample_blood_report.pdf", "file_name": "sample_blood_report.pdf", "is_demo": True
        },
    ]

    report_ids = {}
    for i, r in enumerate(reports_data):
        r.setdefault("file_size", 1024)
        r.setdefault("doctor_notes", None)
        result = await db.reports.insert_one(r)
        report_ids[f"R{i+1:03d}"] = str(result.inserted_id)

    print(f"✓ Created {len(reports_data)} medical reports (marked as DEMO/SAMPLE)")

    # ── AI Analysis — try real analyzers, fallback to static clinical data ──
    upload_dir = (Path(__file__).parent / "uploads").resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)

    ai_analysis_ok = False
    try:
        from ai.mri.analyzer import MRIAnalyzer
        from ai.xray.analyzer import XRayAnalyzer
        from ai.ecg.analyzer import ECGAnalyzer
        from ai.blood.analyzer import BloodReportAnalyzer

        mri_analyzer = MRIAnalyzer(upload_dir=str(upload_dir))
        xray_analyzer = XRayAnalyzer(upload_dir=str(upload_dir))
        ecg_analyzer = ECGAnalyzer(upload_dir=str(upload_dir))
        blood_analyzer = BloodReportAnalyzer(upload_dir=str(upload_dir))

        mri_file = upload_dir / "sample_brain_mri.png"
        xray_file = upload_dir / "sample_chest_xray.png"
        ecg_file = upload_dir / "sample_ecg.png"
        blood_file = upload_dir / "sample_blood_report.pdf"

        if mri_file.exists() and mri_analyzer.is_available():
            mri_res = await mri_analyzer.analyze(str(mri_file), "image/png", report_ids["R001"], p1)
            await db.ai_analysis.insert_one({
                "report_id": report_ids["R001"], "patient_id": p1, "type": "Brain MRI",
                "modality": mri_res.modality, "model_name": mri_res.model_name, "model_type": mri_res.model_type,
                "confidence": mri_res.confidence,
                "findings": [{"label": f.label, "value": f.value, "status": f.status, "detail": f.detail} for f in mri_res.findings],
                "summary": mri_res.summary, "recommendations": mri_res.recommendations,
                "output_image_url": mri_res.output_image_url, "processed_at": mri_res.processed_at,
                "status": mri_res.status, "is_demo": True,
            })
            await db.reports.update_one({"_id": ObjectId(report_ids["R001"])}, {"$set": {"ai_confidence": mri_res.confidence, "findings": [f.label for f in mri_res.findings if f.status != "Normal"], "summary": mri_res.summary}})
            ai_analysis_ok = True
        else:
            raise FileNotFoundError("Sample MRI or model not available")
    except Exception as e:
        print(f"⚠ Real AI analysis skipped ({e}). Using static clinical fallback data.")

    if not ai_analysis_ok:
        # ── Static fallback clinical data ──
        await db.ai_analysis.insert_one({
            "report_id": report_ids["R001"], "patient_id": p1, "type": "Brain MRI",
            "modality": "Brain MRI", "model_name": "BrainCNN Tissue Classifier",
            "model_type": "CNN (Conv2d × 3 + FC) — PyTorch", "confidence": 92.3,
            "findings": [
                {"label": "CSF Distribution", "value": "15.2% of analyzed regions", "status": "Normal", "detail": "Cerebrospinal fluid within normal limits"},
                {"label": "Gray Matter Distribution", "value": "42.8% of analyzed regions", "status": "Normal", "detail": "Gray matter volume age-appropriate"},
                {"label": "White Matter Distribution", "value": "42.0% of analyzed regions", "status": "Normal", "detail": "White matter integrity preserved"},
                {"label": "Small Vessel Changes", "value": "Periventricular ischemic foci detected", "status": "Abnormal", "detail": "Mild small vessel disease — correlate with vascular risk factors"},
                {"label": "Cerebral Atrophy", "value": "Mild generalized atrophy", "status": "Borderline", "detail": "Age-appropriate borderline atrophy pattern"},
            ],
            "summary": "Brain MRI analysis completed. Mild small vessel ischemic changes in periventricular regions. Mild generalized cerebral atrophy (age-appropriate). No acute infarct or mass lesion. Average confidence: 92.3%.",
            "recommendations": ["Compare with prior imaging", "Correlate with neurological exam", "Consider follow-up in 6 months", "Evaluate vascular risk factor management"],
            "output_image_url": "", "processed_at": "2026-09-01T14:00:00", "status": "Completed", "is_demo": True,
        })
        await db.reports.update_one({"_id": ObjectId(report_ids["R001"])}, {"$set": {"ai_confidence": 92.3, "findings": ["Small Vessel Changes", "Cerebral Atrophy"], "summary": "Mild small vessel ischemic changes. Mild cerebral atrophy. No acute lesion."}})

        await db.ai_analysis.insert_one({
            "report_id": report_ids["R002"], "patient_id": p1, "type": "X-ray",
            "modality": "X-ray", "model_name": "DenseNet-121 (ImageNet Pretrained)",
            "model_type": "Pretrained CNN — Feature Extraction", "confidence": 88.5,
            "findings": [
                {"label": "Lung Field Clarity", "value": "Clear bilateral lung fields", "status": "Normal", "detail": "No infiltrates or consolidation"},
                {"label": "Cardiac Silhouette", "value": "Normal cardiothoracic ratio", "status": "Normal", "detail": "Heart size within normal limits"},
                {"label": "Mediastinal Contour", "value": "Normal mediastinal width", "status": "Normal", "detail": "No widening or mass"},
                {"label": "Costophrenic Angles", "value": "Sharp bilaterally", "status": "Normal", "detail": "No pleural effusion"},
                {"label": "Bony Structures", "value": "Intact osseous structures", "status": "Normal", "detail": "No fractures identified"},
            ],
            "summary": "Chest X-ray shows normal cardiopulmonary findings. Clear lung fields, normal heart size, no pleural effusion. AI-assisted — requires physician review.",
            "recommendations": ["No immediate follow-up imaging needed", "Correlate with clinical presentation", "Annual screening recommended"],
            "output_image_url": "", "processed_at": "2026-08-28T10:00:00", "status": "Completed", "is_demo": True,
        })
        await db.reports.update_one({"_id": ObjectId(report_ids["R002"])}, {"$set": {"ai_confidence": 88.5, "findings": [], "summary": "Normal cardiopulmonary findings. Clear lung fields bilaterally."}})

        await db.ai_analysis.insert_one({
            "report_id": report_ids["R003"], "patient_id": p1, "type": "ECG",
            "modality": "ECG", "model_name": "ResNet-18 (ImageNet Pretrained)",
            "model_type": "Pretrained CNN — Feature Extraction", "confidence": 85.2,
            "findings": [
                {"label": "Heart Rate Pattern", "value": "Normal sinus rhythm at 78 bpm", "status": "Normal", "detail": "Regular rhythm with consistent intervals"},
                {"label": "P-Wave Morphology", "value": "Normal P-wave morphology", "status": "Normal", "detail": "Atrial depolarization within normal limits"},
                {"label": "QRS Complex", "value": "Normal duration and amplitude", "status": "Normal", "detail": "No bundle branch block or pre-excitation"},
                {"label": "ST Segment", "value": "No significant ST changes", "status": "Normal", "detail": "No elevation or depression"},
                {"label": "T-Wave Pattern", "value": "Normal T-wave morphology", "status": "Normal", "detail": "Appropriate repolarization pattern"},
                {"label": "Left Ventricular Hypertrophy", "value": "Mild LVH by voltage criteria", "status": "Borderline", "detail": "Sokolow-Lyon voltage criteria borderline — clinical correlation recommended"},
            ],
            "summary": "12-lead ECG shows normal sinus rhythm at 78 bpm. Mild left ventricular hypertrophy by voltage criteria. No acute ST-segment or T-wave changes. AI-assisted — requires physician review.",
            "recommendations": ["Correlate LVH finding with echocardiography", "Monitor blood pressure control", "Compare with previous ECG recordings", "Consider 24-hour Holter if palpitations reported"],
            "output_image_url": "", "processed_at": "2026-08-28T10:30:00", "status": "Completed", "is_demo": True,
        })
        await db.reports.update_one({"_id": ObjectId(report_ids["R003"])}, {"$set": {"ai_confidence": 85.2, "findings": ["Left Ventricular Hypertrophy"], "summary": "Normal sinus rhythm. Mild LVH by voltage criteria. No acute ST/T changes."}})

        await db.ai_analysis.insert_one({
            "report_id": report_ids["R004"], "patient_id": p1, "type": "Blood Test",
            "modality": "Blood Test", "model_name": "Structured Extraction Engine",
            "model_type": "Rule-based + Regex Parser", "confidence": 94.7,
            "findings": [
                {"label": "Hemoglobin", "value": "13.2 g/dL", "status": "Normal", "detail": "Reference: 12.0 - 17.5 g/dL"},
                {"label": "HbA1c", "value": "7.8 %", "status": "Abnormal", "detail": "Reference: 4.0 - 5.7 %. Status: High — suboptimal glycemic control"},
                {"label": "Glucose (Fasting)", "value": "156 mg/dL", "status": "Abnormal", "detail": "Reference: 70.0 - 100.0 mg/dL. Status: High"},
                {"label": "Creatinine", "value": "1.4 mg/dL", "status": "Abnormal", "detail": "Reference: 0.6 - 1.2 mg/dL. Status: High — early renal concern"},
                {"label": "Total Cholesterol", "value": "232 mg/dL", "status": "Abnormal", "detail": "Reference: 0.0 - 200.0 mg/dL. Status: High"},
                {"label": "HDL Cholesterol", "value": "35 mg/dL", "status": "Abnormal", "detail": "Reference: 40.0 - 200.0 mg/dL. Status: Low"},
                {"label": "LDL Cholesterol", "value": "145 mg/dL", "status": "Abnormal", "detail": "Reference: 0.0 - 100.0 mg/dL. Status: High"},
                {"label": "WBC", "value": "7.2 ×10³/µL", "status": "Normal", "detail": "Reference: 4.0 - 11.0 ×10³/µL"},
                {"label": "Platelets", "value": "245 ×10³/µL", "status": "Normal", "detail": "Reference: 150.0 - 400.0 ×10³/µL"},
            ],
            "summary": "Blood report analysis completed. Extracted 9/15 parameters. 5 value(s) outside reference range (HbA1c, Fasting Glucose, Creatinine, Total Cholesterol, HDL low, LDL high). AI-assisted extraction — requires physician review.",
            "recommendations": [
                "HbA1c 7.8% — suboptimal glycemic control, consider medication adjustment",
                "Creatinine 1.4 mg/dL — monitor renal function (eGFR ~58)",
                "Dyslipidemia — elevated LDL, low HDL, elevated total cholesterol",
                "Verify extracted values against original report document",
            ],
            "output_image_url": "", "processed_at": "2026-09-01T15:00:00", "status": "Completed", "is_demo": True,
        })
        await db.reports.update_one({"_id": ObjectId(report_ids["R004"])}, {"$set": {"ai_confidence": 94.7, "findings": ["HbA1c High", "Glucose High", "Creatinine High", "HDL Low", "LDL High"], "summary": "5 abnormal values: HbA1c 7.8%, Glucose 156, Creatinine 1.4, HDL 35, LDL 145."}})

        # Lab values (static)
        lab_values_data = [
            {"name": "Hemoglobin", "value": 13.2, "unit": "g/dL", "reference_range": "12.0 - 17.5 g/dL", "status": "Normal"},
            {"name": "HbA1c", "value": 7.8, "unit": "%", "reference_range": "4.0 - 5.7 %", "status": "High"},
            {"name": "Glucose (Fasting)", "value": 156.0, "unit": "mg/dL", "reference_range": "70.0 - 100.0 mg/dL", "status": "High"},
            {"name": "Creatinine", "value": 1.4, "unit": "mg/dL", "reference_range": "0.6 - 1.2 mg/dL", "status": "High"},
            {"name": "Total Cholesterol", "value": 232.0, "unit": "mg/dL", "reference_range": "0.0 - 200.0 mg/dL", "status": "High"},
            {"name": "HDL Cholesterol", "value": 35.0, "unit": "mg/dL", "reference_range": "40.0 - 200.0 mg/dL", "status": "Low"},
            {"name": "LDL Cholesterol", "value": 145.0, "unit": "mg/dL", "reference_range": "0.0 - 100.0 mg/dL", "status": "High"},
            {"name": "WBC", "value": 7.2, "unit": "×10³/µL", "reference_range": "4.0 - 11.0 ×10³/µL", "status": "Normal"},
            {"name": "Platelets", "value": 245.0, "unit": "×10³/µL", "reference_range": "150.0 - 400.0 ×10³/µL", "status": "Normal"},
        ]
        for lv in lab_values_data:
            await db.lab_values.insert_one({"patient_id": p1, "report_id": report_ids["R004"], **lv, "is_demo": True})

    # 6. Consultation document analysis (R005) — always static
    await db.ai_analysis.insert_one({
        "report_id": report_ids["R005"], "patient_id": p1, "type": "Medical Report",
        "modality": "Medical Report", "model_name": "Clinical NLP Summarizer",
        "model_type": "Medical Document Feature Extractor", "confidence": 90.0,
        "findings": [
            {"label": "Cognitive Assessment", "value": "MMSE score 24/30 — mild impairment", "status": "Abnormal"},
            {"label": "Memory Function", "value": "Short-term memory deficits noted", "status": "Abnormal"},
            {"label": "Motor Function", "value": "No focal neurological deficits", "status": "Normal"},
            {"label": "Cranial Nerves", "value": "Intact bilateral", "status": "Normal"},
        ],
        "summary": "AI-assisted extraction identifies mild cognitive impairment with MMSE score of 24/30.",
        "recommendations": ["Neuropsychological testing for detailed cognitive profile", "Cognitive rehabilitation therapy", "Follow-up assessment in 3 months"],
        "output_image_url": "", "processed_at": "2026-08-15T16:00:00", "status": "Completed", "is_demo": True,
    })

    print(f"✓ Created AI analysis results {'(real model inference)' if ai_analysis_ok else '(static clinical fallback)'}")

    # ── Vital Signs ──
    vital_signs = [
        {"patient_id": p1, "date": "2026-09-01", "blood_pressure": "142/90", "heart_rate": 78, "temperature": 98.4, "oxygen_saturation": 97, "glucose": 156, "weight": 82},
        {"patient_id": p1, "date": "2026-08-15", "blood_pressure": "138/88", "heart_rate": 82, "temperature": 98.6, "oxygen_saturation": 96, "glucose": 148, "weight": 82.5},
        {"patient_id": p1, "date": "2026-08-01", "blood_pressure": "145/92", "heart_rate": 85, "temperature": 98.2, "oxygen_saturation": 97, "glucose": 162, "weight": 83},
        {"patient_id": p1, "date": "2026-07-15", "blood_pressure": "140/89", "heart_rate": 80, "temperature": 98.5, "oxygen_saturation": 98, "glucose": 145, "weight": 83.2},
        {"patient_id": p1, "date": "2026-07-01", "blood_pressure": "136/86", "heart_rate": 76, "temperature": 98.4, "oxygen_saturation": 97, "glucose": 140, "weight": 82.8},
        {"patient_id": p1, "date": "2026-06-15", "blood_pressure": "148/94", "heart_rate": 88, "temperature": 98.7, "oxygen_saturation": 95, "glucose": 170, "weight": 84},
    ]
    if vital_signs:
        await db.vital_signs.insert_many(vital_signs)
    print(f"✓ Created {len(vital_signs)} vital signs")

    # ── Prescriptions ──
    prescriptions_data = [
        {
            "patient_id": p1, "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma",
            "date": "2026-08-28", "status": "Active",
            "diagnosis": "Type 2 Diabetes, Hypertension, Mild Cognitive Impairment",
            "medicines": [
                {"name": "Metformin", "dosage": "1000mg", "frequency": "Twice daily", "duration": "3 months", "instructions": "Take with meals"},
                {"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "duration": "3 months", "instructions": "Take in the morning"},
                {"name": "Atorvastatin", "dosage": "20mg", "frequency": "Once daily", "duration": "3 months", "instructions": "Take at bedtime"},
                {"name": "Donepezil", "dosage": "5mg", "frequency": "Once daily", "duration": "3 months", "instructions": "Take at bedtime"},
            ],
            "notes": "Monitor blood glucose regularly. Follow diabetic diet. Report any dizziness or confusion. Next cognitive assessment in 3 months.",
            "follow_up_date": "2026-09-12",
        },
        {
            "patient_id": p1, "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma",
            "date": "2026-06-15", "status": "Completed",
            "diagnosis": "Type 2 Diabetes, Hypertension",
            "medicines": [
                {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily", "duration": "3 months", "instructions": "Take with meals"},
                {"name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "duration": "3 months", "instructions": "Take in the morning"},
                {"name": "Atorvastatin", "dosage": "10mg", "frequency": "Once daily", "duration": "3 months", "instructions": "Take at bedtime"},
            ],
            "notes": "Initial prescription. Titrate Metformin if tolerated well. Follow up in 3 months with blood work.",
            "follow_up_date": "2026-08-28",
        },
    ]
    for rx in prescriptions_data:
        await db.prescriptions.insert_one(rx)
    print(f"✓ Created {len(prescriptions_data)} prescriptions")

    # ── Appointments ──
    appointments_data = [
        {"patient_id": p1, "patient_name": "Rajesh Kumar", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-12", "time": "10:00 AM", "type": "Follow-up", "status": "Scheduled", "notes": "Review blood work and MRI results"},
        {"patient_id": patient_ids["Anita Desai"], "patient_name": "Anita Desai", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-15", "time": "11:30 AM", "type": "Follow-up", "status": "Scheduled", "notes": "Migraine assessment follow-up"},
        {"patient_id": patient_ids["Suresh Patel"], "patient_name": "Suresh Patel", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-10", "time": "09:00 AM", "type": "Report Review", "status": "Scheduled", "notes": "Review ECG findings — flagged for ischemic changes"},
        {"patient_id": patient_ids["Amit Singh"], "patient_name": "Amit Singh", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-08", "time": "02:00 PM", "type": "Follow-up", "status": "Scheduled", "notes": "CKD follow-up and renal panel review"},
        {"patient_id": patient_ids["Meera Joshi"], "patient_name": "Meera Joshi", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-20", "time": "03:30 PM", "type": "Consultation", "status": "Scheduled", "notes": "Epilepsy management review"},
        {"patient_id": p1, "patient_name": "Rajesh Kumar", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-08-28", "time": "10:00 AM", "type": "Consultation", "status": "Completed", "notes": "Initial neurological consultation completed"},
        {"patient_id": patient_ids["Lakshmi Nair"], "patient_name": "Lakshmi Nair", "doctor_id": doctor_profile_id, "doctor_name": "Dr. Priya Sharma", "date": "2026-09-18", "time": "04:00 PM", "type": "Follow-up", "status": "Scheduled", "notes": "Arthritis medication review"},
    ]
    for a in appointments_data:
        await db.appointments.insert_one(a)
    print(f"✓ Created {len(appointments_data)} appointments")

    # ── Medical History Timeline ──
    timeline = [
        {"patient_id": p1, "date": "2026-09-01", "title": "Brain MRI & Blood Panel", "description": "Routine follow-up MRI and comprehensive blood work completed. AI analysis pending review.", "type": "report"},
        {"patient_id": p1, "date": "2026-08-28", "title": "Neurological Consultation", "description": "Consultation with Dr. Priya Sharma. ECG and Chest X-ray performed. Prescription updated.", "type": "visit"},
        {"patient_id": p1, "date": "2026-08-15", "title": "MMSE Assessment", "description": "Mini-Mental State Examination scored 24/30. Mild cognitive impairment diagnosed.", "type": "diagnosis"},
        {"patient_id": p1, "date": "2026-06-15", "title": "Initial Visit", "description": "First visit for persistent headaches and memory concerns. Type 2 Diabetes and Hypertension noted. Initial prescription issued.", "type": "visit"},
        {"patient_id": p1, "date": "2026-03-10", "title": "Diabetes Diagnosis", "description": "Diagnosed with Type 2 Diabetes Mellitus at local clinic. HbA1c was 8.2% at diagnosis.", "type": "diagnosis"},
        {"patient_id": p1, "date": "2025-11-20", "title": "Hypertension Diagnosis", "description": "Diagnosed with Stage 1 Hypertension. BP was 152/96 mmHg on multiple readings.", "type": "diagnosis"},
    ]
    for t in timeline:
        await db.medical_history.insert_one(t)
    print(f"✓ Created {len(timeline)} timeline events")

    # ── Research Evidence ──
    evidence = [
        {"title": "Small Vessel Disease and Cognitive Impairment: A Systematic Review and Meta-Analysis", "authors": "Pantoni L, et al.", "journal": "The Lancet Neurology", "year": 2023, "doi": "10.1016/S1474-4422(23)00123-4", "relevance": "Directly relevant to MRI findings of small vessel ischemic changes and cognitive decline", "summary": "Meta-analysis of 42 studies demonstrating strong association between cerebral small vessel disease markers on MRI and risk of cognitive decline."},
        {"title": "Diabetes, Cognitive Decline, and Alzheimer Disease: ADA-AAN Joint Statement", "authors": "American Diabetes Association & American Academy of Neurology", "journal": "Neurology", "year": 2024, "doi": "10.1212/WNL.0000000000201234", "relevance": "Clinical guideline linking diabetes management with cognitive outcomes", "summary": "Joint statement recommending cognitive screening in diabetic patients over 65."},
        {"title": "Blood Pressure Control and Dementia Risk: SPRINT MIND Trial Extended Follow-up", "authors": "Williamson JD, et al.", "journal": "JAMA", "year": 2023, "doi": "10.1001/jama.2023.4567", "relevance": "Supports aggressive blood pressure management in patient with hypertension and cognitive risk", "summary": "Extended follow-up showing intensive blood pressure lowering reduced risk of mild cognitive impairment by 19%."},
        {"title": "LVH Regression with Antihypertensive Therapy: Meta-Analysis of ECG and Echo Studies", "authors": "Fagard RH, et al.", "journal": "European Heart Journal", "year": 2022, "doi": "10.1093/eurheartj/ehac789", "relevance": "Supports ECG finding of mild LVH and management approach", "summary": "Meta-analysis showing LVH regression is achievable with adequate blood pressure control."},
        {"title": "Donepezil for Mild Cognitive Impairment: Updated Cochrane Review", "authors": "Birks JS, Harvey RJ", "journal": "Cochrane Database of Systematic Reviews", "year": 2024, "doi": "10.1002/14651858.CD001190.pub4", "relevance": "Supports current prescription of donepezil for MCI", "summary": "Updated review indicating moderate evidence for donepezil in slowing cognitive decline in MCI patients."},
        {"title": "Statin Therapy and Cognitive Function: A Systematic Review", "authors": "McGuinness B, et al.", "journal": "Annals of Internal Medicine", "year": 2023, "doi": "10.7326/M23-0456", "relevance": "Relevant to atorvastatin prescription and cognitive impairment concerns", "summary": "Systematic review found no evidence of cognitive harm from statin therapy."},
    ]
    for e in evidence:
        await db.research_evidence.insert_one(e)
    print(f"✓ Created {len(evidence)} research evidence entries")

    # ── AI Patient Brief ──
    await db.ai_patient_briefs.insert_one({
        "patient_id": p1,
        "patient_info": {"name": "Rajesh Kumar", "age": 45, "gender": "Male", "blood_group": "B+", "conditions": ["Type 2 Diabetes", "Hypertension", "Mild Cognitive Impairment"]},
        "symptoms": ["Persistent headaches (intermittent, 3-4 times/week)", "Short-term memory difficulties", "Occasional dizziness", "Fatigue and reduced concentration"],
        "current_reports": [
            {"type": "Brain MRI", "date": "2026-09-01", "key_findings": ["Small vessel ischemic changes", "Mild cerebral atrophy"]},
            {"type": "Chest X-ray", "date": "2026-08-28", "key_findings": ["Normal cardiopulmonary findings"]},
            {"type": "12-Lead ECG", "date": "2026-08-28", "key_findings": ["Normal sinus rhythm", "Mild LVH"]},
            {"type": "Blood Panel", "date": "2026-09-01", "key_findings": ["HbA1c 7.8%", "eGFR 58", "Low HDL"]},
        ],
        "mri_findings": ["Small vessel ischemic changes in periventricular regions", "Mild generalized cerebral atrophy (age-appropriate)", "No acute infarct or mass lesion detected", "Confidence: 92%"],
        "xray_findings": ["Normal cardiothoracic ratio", "Clear lung fields bilaterally", "No pleural effusion or pneumothorax", "Confidence: 95%"],
        "ecg_findings": ["Normal sinus rhythm at 78 bpm", "Mild left ventricular hypertrophy (voltage criteria)", "No acute ST-segment or T-wave changes", "Confidence: 88%"],
        "blood_report_abnormalities": ["HbA1c 7.8% (Target: <7.0%) — suboptimal glycemic control", "Fasting glucose 156 mg/dL (elevated)", "Creatinine 1.4 mg/dL, eGFR 58 — early renal decline", "HDL 35 mg/dL (low), LDL 145 mg/dL (elevated)", "Hemoglobin 13.2 g/dL (borderline low)"],
        "previous_prescriptions": ["Metformin 1000mg BD (increased from 500mg)", "Amlodipine 5mg OD", "Atorvastatin 20mg HS (increased from 10mg)", "Donepezil 5mg HS (newly added)"],
        "important_observations": [
            "Progressive cognitive decline with MMSE 24/30 — correlates with MRI small vessel disease",
            "Suboptimal diabetes control despite medication — consider endocrinology referral",
            "Early renal function decline — monitor closely given diabetes and hypertension",
            "Cardiovascular risk profile: multiple risk factors (DM, HTN, dyslipidemia, LVH)",
            "Current medications appropriate but may need dose optimization",
        ],
        "generated_at": "2026-09-01T16:00:00",
    })
    print("✓ Created AI patient brief")

    # ── Notifications ──
    notifs = [
        {"target_role": "doctor", "title": "AI Analysis Complete", "message": "Brain MRI analysis for Rajesh Kumar is ready for review.", "time": "2 hours ago", "read": False, "type": "info"},
        {"target_role": "doctor", "title": "Flagged Report", "message": "ECG analysis for Suresh Patel has been flagged — T-wave inversions detected.", "time": "5 hours ago", "read": False, "type": "alert"},
        {"target_role": "doctor", "title": "Upcoming Appointment", "message": "Follow-up with Amit Singh scheduled for Sep 8 at 2:00 PM.", "time": "1 day ago", "read": True, "type": "info"},
        {"target_role": "doctor", "title": "Blood Test Results", "message": "New blood panel results uploaded for Rajesh Kumar.", "time": "1 day ago", "read": True, "type": "success"},
        {"target_role": "doctor", "title": "Prescription Reminder", "message": "Metformin dosage was increased to 1000mg for Rajesh Kumar.", "time": "3 days ago", "read": True, "type": "warning"},
        {"target_role": "patient", "patient_id": p1, "title": "Report Ready", "message": "Your Brain MRI analysis is complete. Your doctor will review it shortly.", "time": "2 hours ago", "read": False, "type": "info"},
        {"target_role": "patient", "patient_id": p1, "title": "Upcoming Appointment", "message": "You have a follow-up appointment with Dr. Priya Sharma on Sep 12 at 10:00 AM.", "time": "1 day ago", "read": False, "type": "info"},
        {"target_role": "patient", "patient_id": p1, "title": "Prescription Updated", "message": "Your prescription has been updated. Please review new medications.", "time": "3 days ago", "read": True, "type": "success"},
        {"target_role": "patient", "patient_id": p1, "title": "Health Tip", "message": "Remember to monitor your blood glucose levels daily.", "time": "5 days ago", "read": True, "type": "info"},
    ]
    for n in notifs:
        await db.notifications.insert_one(n)
    print(f"✓ Created {len(notifs)} notifications")

    print("\n✅ Database seeded with development fixtures!")
    print(f"\n📋 Login credentials:")
    print(f"   Patient: rajesh.kumar@email.com / password123")
    print(f"   Doctor:  dr.priya@medcare.in / password123")

    # Don't close client here — it may be shared with the app via database.py
    # The standalone __main__ block handles cleanup separately


if __name__ == "__main__":
    import sys
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env == "production":
        print("\n❌ REFUSED: seed.py cannot be executed in a production environment.")
        print("Production databases must receive data exclusively from real application workflows.\n")
        sys.exit(1)

    print("\n⚠️  DEVELOPMENT/TESTING FIXTURE GENERATOR")
    print("This script will replace all existing collections with local sample demo fixtures.")
    print("To bypass prompt in scripts, pass: python seed.py --populate-dev\n")

    if "--populate-dev" not in sys.argv:
        try:
            confirm = input("Are you sure you want to seed development fixtures? (yes/no): ").strip().lower()
            if confirm not in ("y", "yes"):
                print("Aborted.")
                sys.exit(0)
        except EOFError:
            pass

    asyncio.run(seed())
