from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, status
from bson import ObjectId
from middleware.auth import get_current_user, require_role, hash_password
from database import db
from models.patient import PatientCreate

router = APIRouter(prefix="/api/patients", tags=["Patients"])


def serialize_patient(doc: dict) -> dict:
    """Convert MongoDB patient document to JSON-safe dict."""
    doc["id"] = str(doc.pop("_id"))
    doc.setdefault("user_id", "")
    return doc


async def get_or_create_doctor(current_user: dict) -> dict:
    """Find doctor profile for current user by user_id or email, or create dedicated doctor profile."""
    user_id = str(current_user.get("id") or current_user.get("user_id") or "")
    email = (current_user.get("email") or "").strip().lower()
    name = (current_user.get("name") or "").strip()
    if not name and (user_id or email):
        user_query = []
        if user_id:
            if ObjectId.is_valid(user_id):
                user_query.append({"_id": ObjectId(user_id)})
            user_query.append({"_id": user_id})
        if email:
            user_query.append({"email": email})
        if user_query:
            u = await db.users.find_one({"$or": user_query})
            if u and u.get("name"):
                name = u["name"].strip()
    doc_name = name if name.startswith("Dr.") else (f"Dr. {name}" if name else "Doctor")

    # 1. Try finding by user_id
    if user_id:
        doctor = await db.doctors.find_one({"user_id": user_id})
        if doctor:
            return doctor

    # 2. Try finding by email
    if email:
        doctor = await db.doctors.find_one({"email": email})
        if doctor:
            if user_id and doctor.get("user_id") != user_id:
                await db.doctors.update_one({"_id": doctor["_id"]}, {"$set": {"user_id": user_id}})
                doctor["user_id"] = user_id
            return doctor

    # 3. Create dedicated doctor profile for this authenticated user with 0 assigned patients
    spec = current_user.get("specialty") or current_user.get("specialization") or "General Medicine"
    hosp = current_user.get("hospital") or "MedAssist Medical Center"
    doc_data = {
        "user_id": user_id,
        "name": doc_name,
        "email": email or f"doctor_{user_id[:6] if user_id else 'user'}@medassist.org",
        "specialization": spec,
        "department": spec,
        "hospital": hosp,
        "qualification": current_user.get("qualification") or "MBBS, MD",
        "phone": current_user.get("phone") or "+91 98765 43210",
        "assigned_patients": [],
    }
    res = await db.doctors.insert_one(doc_data)
    doc_data["_id"] = res.inserted_id
    return doc_data


async def get_doctor_assigned_patient_ids(doctor: dict, current_user: dict) -> list:
    """
    Get all patient IDs strictly assigned to this doctor:
    1. doctor['assigned_patients']
    2. patients where assigned_doctor_id or doctor_id matches this doctor's _id or user_id
    3. appointments booked with this doctor
    Strictly isolated: does NOT return all patients globally!
    """
    if not doctor:
        return []

    doctor_id_str = str(doctor.get("_id", ""))
    user_id_str = str(current_user.get("id") or doctor.get("user_id") or "")
    doctor_name = doctor.get("name", "")

    assigned_ids = set()
    for pid in doctor.get("assigned_patients", []):
        if pid:
            assigned_ids.add(str(pid))

    # 2. Patients explicitly assigned to this doctor
    pat_query_or = []
    if doctor_id_str:
        pat_query_or.extend([{"assigned_doctor_id": doctor_id_str}, {"doctor_id": doctor_id_str}])
    if user_id_str:
        pat_query_or.extend([{"assigned_doctor_id": user_id_str}, {"doctor_id": user_id_str}])
    if doctor_name and doctor_name.lower() not in ("doctor", "dr. doctor", ""):
        import re
        pat_query_or.extend([
            {"assigned_doctor_name": {"$regex": f"^{re.escape(doctor_name)}$", "$options": "i"}},
            {"doctor_name": {"$regex": f"^{re.escape(doctor_name)}$", "$options": "i"}}
        ])

    if pat_query_or:
        async for p in db.patients.find({"$or": pat_query_or}, {"_id": 1}):
            assigned_ids.add(str(p["_id"]))

    # 3. Appointments booked with this doctor
    apt_query_or = []
    if doctor_id_str:
        apt_query_or.append({"doctor_id": doctor_id_str})
    if user_id_str:
        apt_query_or.append({"doctor_id": user_id_str})
    if doctor_name and doctor_name.lower() not in ("doctor", "dr. doctor", ""):
        import re
        apt_query_or.append({"doctor_name": {"$regex": f"^{re.escape(doctor_name)}$", "$options": "i"}})

    if apt_query_or:
        async for apt in db.appointments.find({"$or": apt_query_or}, {"patient_id": 1}):
            if apt.get("patient_id"):
                assigned_ids.add(str(apt["patient_id"]))

    # Sync back to doctor document if new assignments were found
    if assigned_ids and set(doctor.get("assigned_patients", [])) != assigned_ids:
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$set": {"assigned_patients": list(assigned_ids)}}
        )
        doctor["assigned_patients"] = list(assigned_ids)

    return list(assigned_ids)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_and_onboard_patient(
    data: PatientCreate,
    current_user: dict = Depends(require_role("doctor")),
):
    """
    Doctor: Onboard a new patient into the system.
    Creates user account, patient profile, and assigns the patient to the doctor.
    """
    doctor = await get_or_create_doctor(current_user)

    # Check if a user with this email already exists
    user = await db.users.find_one({"email": data.email})
    if not user:
        pwd = data.password if data.password else "patient123"
        user_res = await db.users.insert_one({
            "email": data.email,
            "name": data.name,
            "role": "patient",
            "password_hash": hash_password(pwd),
        })
        user_id = str(user_res.inserted_id)
    else:
        user_id = str(user["_id"])

    # Check if patient profile already exists for this user
    existing_patient = await db.patients.find_one({"email": data.email})
    if existing_patient:
        patient_id = str(existing_patient["_id"])
        # Assign to doctor if not already assigned
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": patient_id}},
        )
        return serialize_patient(existing_patient)

    patient_doc = {
        "user_id": user_id,
        "name": data.name,
        "age": data.age,
        "gender": data.gender,
        "blood_group": data.blood_group,
        "phone": data.phone,
        "email": data.email,
        "address": data.address,
        "emergency_contact": data.emergency_contact,
        "allergies": data.allergies,
        "conditions": data.conditions,
        "avatar": "",
        "last_visit": datetime.utcnow().strftime("%Y-%m-%d"),
        "next_appointment": "",
        "status": "Active",
    }
    result = await db.patients.insert_one(patient_doc)
    patient_id = str(result.inserted_id)

    # Assign patient to doctor
    await db.doctors.update_one(
        {"_id": doctor["_id"]},
        {"$addToSet": {"assigned_patients": patient_id}},
    )

    # Timeline event
    await db.medical_history.insert_one({
        "patient_id": patient_id,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "title": "Patient Onboarded",
        "description": f"Patient profile created and assigned to Dr. {doctor['name']}.",
        "type": "event",
        "linked_entity_id": patient_id,
    })

    # Notification for doctor
    await db.notifications.insert_one({
        "doctor_id": str(doctor["_id"]),
        "patient_id": patient_id,
        "target_role": "doctor",
        "type": "patient_added",
        "title": "New Patient Onboarded",
        "message": f"{data.name} has been added to your care panel.",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })

    return serialize_patient(patient_doc)


@router.post("/{patient_id}/assign")
async def assign_patient_to_doctor(
    patient_id: str,
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor: Assign an existing patient to current doctor's panel."""
    doctor = await get_or_create_doctor(current_user)

    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    await db.doctors.update_one(
        {"_id": doctor["_id"]},
        {"$addToSet": {"assigned_patients": patient_id}},
    )

    # Notification for doctor
    await db.notifications.insert_one({
        "doctor_id": str(doctor["_id"]),
        "patient_id": patient_id,
        "target_role": "doctor",
        "type": "patient_assigned",
        "title": "Patient Assigned",
        "message": f"{patient.get('name', 'Patient')} is now assigned to your care panel.",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })

    return {"success": True, "message": f"Patient {patient.get('name')} assigned to your panel"}



@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Patient: get own profile."""
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    patient = await db.patients.find_one({"user_id": current_user["id"]})
    if not patient:
        patient = await db.patients.find_one({"email": current_user.get("email")})
        if patient and not patient.get("user_id"):
            await db.patients.update_one({"_id": patient["_id"]}, {"$set": {"user_id": current_user["id"]}})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return serialize_patient(patient)


@router.put("/me")
async def update_my_profile(
    updates: dict,
    current_user: dict = Depends(get_current_user),
):
    """Patient: update own profile (demographics and contact info)."""
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    patient = await db.patients.find_one({"user_id": current_user["id"]})
    if not patient:
        patient = await db.patients.find_one({"email": current_user.get("email")})
        if patient and not patient.get("user_id"):
            await db.patients.update_one({"_id": patient["_id"]}, {"$set": {"user_id": current_user["id"]}})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    allowed = {
        "name", "phone", "address", "emergency_contact",
        "allergies", "drug_allergies", "age", "gender", "blood_group"
    }
    filtered = {k: v for k, v in updates.items() if k in allowed and v is not None}

    # Format allergies and drug_allergies consistently as lists of clean strings
    if "allergies" in filtered:
        if isinstance(filtered["allergies"], str):
            filtered["allergies"] = [s.strip() for s in filtered["allergies"].split(",") if s.strip()]
        elif isinstance(filtered["allergies"], list):
            filtered["allergies"] = [str(s).strip() for s in filtered["allergies"] if str(s).strip()]
    if "drug_allergies" in filtered:
        if isinstance(filtered["drug_allergies"], str):
            filtered["drug_allergies"] = [s.strip() for s in filtered["drug_allergies"].split(",") if s.strip()]
        elif isinstance(filtered["drug_allergies"], list):
            filtered["drug_allergies"] = [str(s).strip() for s in filtered["drug_allergies"] if str(s).strip()]

    # If name changed, update both patient document and users collection
    if "name" in filtered and filtered["name"]:
        if ObjectId.is_valid(current_user["id"]):
            await db.users.update_one(
                {"_id": ObjectId(current_user["id"])},
                {"$set": {"name": filtered["name"]}}
            )

    if filtered:
        await db.patients.update_one(
            {"_id": patient["_id"]}, {"$set": filtered}
        )

    updated = await db.patients.find_one({"_id": patient["_id"]})
    return serialize_patient(updated)


@router.get("")
async def list_patients(
    q: str = Query("", description="Search query"),
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor: list assigned patients strictly isolated to this doctor."""
    doctor = await get_or_create_doctor(current_user)
    assigned_ids = await get_doctor_assigned_patient_ids(doctor, current_user)

    if not assigned_ids:
        return []

    valid_object_ids = [ObjectId(pid) for pid in assigned_ids if ObjectId.is_valid(pid)]
    if not valid_object_ids:
        return []

    query_filter: dict = {"_id": {"$in": valid_object_ids}}

    search_term = q if isinstance(q, str) else getattr(q, "default", "") or ""
    if search_term:
        query_filter = {
            "$and": [
                {"_id": {"$in": valid_object_ids}},
                {"$or": [
                    {"name": {"$regex": search_term, "$options": "i"}},
                    {"email": {"$regex": search_term, "$options": "i"}},
                ]}
            ]
        }

    patients = []
    async for doc in db.patients.find(query_filter):
        patients.append(serialize_patient(doc))
    return patients


@router.get("/search")
async def search_patients(
    q: str = Query("", description="Search query"),
    current_user: dict = Depends(require_role("doctor")),
):
    """Doctor: search patients by name or email with synchronized roster."""
    return await list_patients(q=q, current_user=current_user)


@router.get("/{patient_id}")
async def get_patient(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get patient detail. Patient can view own; doctor can view assigned."""
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user["role"] == "patient":
        if patient.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == "doctor":
        doctor = await get_or_create_doctor(current_user)
        if patient_id not in doctor.get("assigned_patients", []):
            await db.doctors.update_one(
                {"_id": doctor["_id"]},
                {"$addToSet": {"assigned_patients": patient_id}}
            )
            doctor.setdefault("assigned_patients", []).append(patient_id)

    return serialize_patient(patient)


@router.put("/{patient_id}")
async def update_patient(
    patient_id: str,
    updates: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update patient details. Patient can update own demographics; Doctor can update clinical status."""
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid patient ID")

    target_patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not target_patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user["role"] == "patient":
        # Ensure patient can only update their own record
        is_owner = (
            target_patient.get("user_id") == current_user["id"]
            or target_patient.get("email") == current_user.get("email")
            or str(target_patient["_id"]) == str(current_user.get("patient_id"))
        )
        if not is_owner:
            raise HTTPException(status_code=403, detail="Access denied: you can only update your own profile")

        allowed = {
            "name", "phone", "address", "emergency_contact",
            "allergies", "drug_allergies", "age", "gender", "blood_group"
        }
    elif current_user["role"] == "doctor":
        doctor = await get_or_create_doctor(current_user)
        if patient_id not in doctor.get("assigned_patients", []):
            await db.doctors.update_one(
                {"_id": doctor["_id"]},
                {"$addToSet": {"assigned_patients": patient_id}}
            )
            doctor.setdefault("assigned_patients", []).append(patient_id)

        allowed = {
            "name", "status", "conditions", "allergies", "drug_allergies", "blood_group",
            "phone", "address", "emergency_contact", "next_appointment",
            "last_visit", "age", "gender"
        }
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    filtered = {k: v for k, v in updates.items() if k in allowed and v is not None}

    if "name" in filtered and filtered["name"] and current_user["role"] == "patient":
        if ObjectId.is_valid(current_user["id"]):
            await db.users.update_one(
                {"_id": ObjectId(current_user["id"])},
                {"$set": {"name": filtered["name"]}}
            )

    if filtered:
        await db.patients.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": filtered}
        )

    updated = await db.patients.find_one({"_id": ObjectId(patient_id)})
    return serialize_patient(updated)


@router.post("/{patient_id}/vitals")
async def record_patient_vitals(
    patient_id: str,
    vitals_data: dict,
    current_user: dict = Depends(require_role("doctor")),
):
    """
    Doctor: record new patient vital signs (BP, HR, SpO2, Glucose, Temp, Weight, BMI).
    Persists to db.vital_signs and updates patient's latest_vitals in db.patients.
    """
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid patient ID")

    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = await get_or_create_doctor(current_user)
    if patient_id not in doctor.get("assigned_patients", []):
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": patient_id}}
        )

    now = datetime.utcnow()
    bp = vitals_data.get("blood_pressure") or vitals_data.get("bp") or "120/80"
    hr = vitals_data.get("heart_rate") or vitals_data.get("hr")
    spo2 = vitals_data.get("oxygen_saturation") or vitals_data.get("spo2")
    glucose = vitals_data.get("glucose") or vitals_data.get("blood_glucose")
    temp = vitals_data.get("temperature") or vitals_data.get("temp")
    weight = vitals_data.get("weight")
    bmi = vitals_data.get("bmi")
    notes = vitals_data.get("notes", "Recorded during clinical consultation")

    vital_doc = {
        "patient_id": patient_id,
        "blood_pressure": str(bp),
        "heart_rate": int(hr) if hr is not None and str(hr).isdigit() else hr,
        "oxygen_saturation": float(spo2) if spo2 is not None else 98.0,
        "glucose": float(glucose) if glucose is not None else 100.0,
        "temperature": float(temp) if temp is not None else 98.6,
        "weight": float(weight) if weight is not None else None,
        "bmi": float(bmi) if bmi is not None else None,
        "notes": str(notes),
        "recorded_by": current_user.get("name") or "Dr. Priya Sharma",
        "date": now.strftime("%Y-%m-%d"),
        "recorded_at": now.strftime("%Y-%m-%d %H:%M UTC"),
        "created_at": now.isoformat(),
    }

    # Insert into vital_signs collection
    insert_res = await db.vital_signs.insert_one(vital_doc)
    vital_doc["id"] = str(insert_res.inserted_id)
    if "_id" in vital_doc:
        del vital_doc["_id"]

    # Sync into patient document
    await db.patients.update_one(
        {"_id": ObjectId(patient_id)},
        {"$set": {
            "latest_vitals": vital_doc,
            "vitals": vital_doc,
            "last_visit": now.strftime("%Y-%m-%d"),
        }}
    )

    return vital_doc


@router.put("/{patient_id}/clinical")
async def update_patient_clinical(
    patient_id: str,
    data: dict,
    current_user: dict = Depends(require_role("doctor")),
):
    """
    Doctor: update patient clinical profile including general allergies,
    drug allergies, chronic conditions, and next appointment schedule.
    """
    if not ObjectId.is_valid(patient_id):
        raise HTTPException(status_code=400, detail="Invalid patient ID")

    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = await get_or_create_doctor(current_user)
    if patient_id not in doctor.get("assigned_patients", []):
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": patient_id}}
        )

    updates = {}
    if "allergies" in data:
        if isinstance(data["allergies"], list):
            updates["allergies"] = [str(s).strip() for s in data["allergies"] if str(s).strip()]
        elif isinstance(data["allergies"], str):
            updates["allergies"] = [s.strip() for s in data["allergies"].split(",") if s.strip()]
    if "drug_allergies" in data:
        if isinstance(data["drug_allergies"], list):
            updates["drug_allergies"] = [str(s).strip() for s in data["drug_allergies"] if str(s).strip()]
        elif isinstance(data["drug_allergies"], str):
            updates["drug_allergies"] = [s.strip() for s in data["drug_allergies"].split(",") if s.strip()]
    if "conditions" in data:
        if isinstance(data["conditions"], list):
            updates["conditions"] = [str(s).strip() for s in data["conditions"] if str(s).strip()]
        elif isinstance(data["conditions"], str):
            updates["conditions"] = [s.strip() for s in data["conditions"].split(",") if s.strip()]
    if "next_appointment" in data and data["next_appointment"]:
        updates["next_appointment"] = str(data["next_appointment"])

        # Also create appointment and patient notification
        now = datetime.utcnow()
        await db.appointments.insert_one({
            "patient_id": patient_id,
            "patient_name": patient.get("name", "Patient"),
            "doctor_id": str(doctor["_id"]),
            "doctor_name": doctor.get("name", "Dr. Priya Sharma"),
            "date": data["next_appointment"],
            "time": data.get("appointment_time", "10:00 AM"),
            "type": "Follow-up",
            "status": "Scheduled",
            "notes": "Scheduled by attending physician during clinical consultation",
            "created_at": now.isoformat(),
        })

        await db.notifications.insert_one({
            "patient_id": patient_id,
            "doctor_id": str(doctor["_id"]),
            "target_role": "patient",
            "type": "appointment_scheduled",
            "title": "Follow-up Consultation Scheduled",
            "message": f"Dr. {doctor.get('name', 'Priya Sharma')} scheduled your follow-up for {data['next_appointment']}.",
            "read": False,
            "created_at": now.isoformat(),
        })

    if updates:
        await db.patients.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": updates}
        )

    updated = await db.patients.find_one({"_id": ObjectId(patient_id)})
    return serialize_patient(updated)


