from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from models.appointment import AppointmentCreate, AppointmentUpdate
from middleware.auth import get_current_user
from database import db

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


def serialize_appointment(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
async def list_appointments(current_user: dict = Depends(get_current_user)):
    """List appointments for the current user."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            patient = await db.patients.find_one({"email": current_user.get("email")})
        if not patient:
            return []
        pid_str = str(patient["_id"])
        query = {
            "$or": [
                {"patient_id": pid_str},
                {"patient_id": current_user["id"]},
            ]
        }
        cursor = db.appointments.find(query).sort("date", -1)
    else:
        from routes.patients import get_or_create_doctor
        doctor = await get_or_create_doctor(current_user)
        doctor_id_str = str(doctor["_id"])
        user_id_str = str(current_user["id"])
        assigned_pids = doctor.get("assigned_patients", [])
        doctor_name = doctor.get("name", current_user.get("name", ""))

        or_conditions = [
            {"doctor_id": {"$in": [doctor_id_str, user_id_str]}},
        ]
        if doctor_name and doctor_name.lower() not in ("doctor", "dr. doctor", ""):
            import re
            or_conditions.append({"doctor_name": {"$regex": f"^{re.escape(doctor_name)}$", "$options": "i"}})

        cursor = db.appointments.find({"$or": or_conditions}).sort("date", -1)

    appointments = []
    async for doc in cursor:
        apt = serialize_appointment(doc)
        # Enrich patient_name from db.patients if missing
        if not apt.get("patient_name") and apt.get("patient_id"):
            if ObjectId.is_valid(apt["patient_id"]):
                pt = await db.patients.find_one({"_id": ObjectId(apt["patient_id"])})
                if pt:
                    apt["patient_name"] = pt.get("name", "Patient")
        appointments.append(apt)
    return appointments


@router.post("")
async def create_appointment(
    data: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new appointment."""
    from routes.patients import get_or_create_doctor

    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            patient = await db.patients.find_one({"email": current_user.get("email")})
            if patient and not patient.get("user_id"):
                await db.patients.update_one({"_id": patient["_id"]}, {"$set": {"user_id": current_user["id"]}})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

        # Find doctor
        doctor = None
        from routes.patients import get_or_create_doctor

        if data.doctor_id:
            if ObjectId.is_valid(data.doctor_id):
                try:
                    doctor = await db.doctors.find_one({"_id": ObjectId(data.doctor_id)})
                except Exception:
                    pass
            if not doctor:
                doctor = await db.doctors.find_one({"user_id": data.doctor_id})
            if not doctor:
                # Check if doctor_id refers to a doctor user in db.users
                doc_user = None
                if ObjectId.is_valid(data.doctor_id):
                    doc_user = await db.users.find_one({"_id": ObjectId(data.doctor_id)})
                if not doc_user:
                    doc_user = await db.users.find_one({"_id": data.doctor_id})
                if doc_user and doc_user.get("role") == "doctor":
                    doctor = await get_or_create_doctor({
                        "id": str(doc_user["_id"]),
                        "email": doc_user["email"],
                        "name": doc_user.get("name"),
                        "specialization": doc_user.get("specialization")
                    })

        if not doctor and data.doctor_name:
            doctor = await db.doctors.find_one({"name": {"$regex": f"^{data.doctor_name}$", "$options": "i"}})
            if not doctor:
                doc_user = await db.users.find_one({"name": {"$regex": f"^{data.doctor_name}$", "$options": "i"}, "role": "doctor"})
                if doc_user:
                    doctor = await get_or_create_doctor({
                        "id": str(doc_user["_id"]),
                        "email": doc_user["email"],
                        "name": doc_user.get("name"),
                        "specialization": doc_user.get("specialization")
                    })

        if not doctor and patient.get("assigned_doctor_id") and ObjectId.is_valid(str(patient["assigned_doctor_id"])):
            try:
                doctor = await db.doctors.find_one({"_id": ObjectId(str(patient["assigned_doctor_id"]))})
            except Exception:
                pass
        if not doctor and patient.get("doctor_id") and ObjectId.is_valid(str(patient["doctor_id"])):
            try:
                doctor = await db.doctors.find_one({"_id": ObjectId(str(patient["doctor_id"]))})
            except Exception:
                pass
        if not doctor and patient.get("assigned_doctor_name"):
            doctor = await db.doctors.find_one({"name": {"$regex": f"^{patient['assigned_doctor_name']}$", "$options": "i"}})
        if not doctor and patient.get("doctor_name"):
            doctor = await db.doctors.find_one({"name": {"$regex": f"^{patient['doctor_name']}$", "$options": "i"}})
        if not doctor:
            doctor = await db.doctors.find_one({})
        if not doctor:
            raise HTTPException(status_code=404, detail="No doctor available")

        from datetime import datetime
        patient_name = patient.get("name") or current_user.get("name", "Patient")
        doctor_name = doctor.get("name", "Dr. Priya Sharma")
        if not doctor_name.startswith("Dr."):
            doctor_name = f"Dr. {doctor_name}"

        patient_id_str = str(patient["_id"])
        doctor_id_str = str(doctor["_id"])
        doctor_user_id_str = str(doctor.get("user_id") or "")

        apt_doc = {
            "patient_id": patient_id_str,
            "patient_name": patient_name,
            "doctor_id": doctor_id_str,
            "doctor_name": doctor_name,
            "date": data.date,
            "time": data.time,
            "type": data.type or "Consultation",
            "status": "Scheduled",
            "notes": data.notes or "Scheduled via patient portal",
            "created_at": datetime.utcnow().isoformat(),
        }
        result = await db.appointments.insert_one(apt_doc)
        apt_doc["id"] = str(result.inserted_id)

        # 1. Automatically link patient to the doctor's assigned roster (and any doctor record matching ID, user_id or name)
        doctor_query_or = [{"_id": doctor["_id"]}]
        if doctor_user_id_str:
            doctor_query_or.append({"user_id": doctor_user_id_str})
        if doctor_name:
            doctor_query_or.append({"name": {"$regex": f"^{doctor_name}$", "$options": "i"}})

        await db.doctors.update_many(
            {"$or": doctor_query_or},
            {"$addToSet": {"assigned_patients": patient_id_str}}
        )

        # 2. Update patient profile with assigned doctor info permanently
        await db.patients.update_one(
            {"_id": patient["_id"]},
            {"$set": {
                "next_appointment": f"{data.date} at {data.time}",
                "doctor_id": doctor_id_str,
                "doctor_name": doctor_name,
                "assigned_doctor_id": doctor_id_str,
                "assigned_doctor_name": doctor_name,
            }}
        )

        # 3. Create real-time notification for the doctor
        notification_doc = {
            "doctor_id": doctor_id_str,
            "patient_id": patient_id_str,
            "patient_name": patient_name,
            "target_role": "doctor",
            "type": "new_appointment",
            "title": "New Appointment Booked",
            "message": f"{patient_name} booked a {data.type or 'Consultation'} on {data.date} at {data.time}.",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        }
        if doctor_user_id_str:
            notification_doc["doctor_user_id"] = doctor_user_id_str

        await db.notifications.insert_one(notification_doc)

        return serialize_appointment(apt_doc)

    # Doctor-initiated
    doctor = await get_or_create_doctor(current_user)
    doctor_name = doctor.get("name") or current_user.get("name", "Dr. Priya Sharma")
    doctor_id_str = str(doctor["_id"])

    # Get patient
    patient = await db.patients.find_one({"_id": ObjectId(data.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Add patient to doctor's assigned roster
    await db.doctors.update_many(
        {"$or": [
            {"_id": doctor["_id"]},
            {"name": {"$regex": f"^{doctor_name}$", "$options": "i"}},
        ]},
        {"$addToSet": {"assigned_patients": data.patient_id}}
    )

    apt_doc = {
        "patient_id": data.patient_id,
        "patient_name": patient.get("name", "Patient"),
        "doctor_id": doctor_id_str,
        "doctor_name": doctor_name,
        "date": data.date,
        "time": data.time,
        "type": data.type or "Consultation",
        "status": "Scheduled",
        "notes": data.notes or "",
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.appointments.insert_one(apt_doc)
    apt_doc["id"] = str(result.inserted_id)

    # Event-driven notification for the patient
    from datetime import datetime
    await db.notifications.insert_one({
        "patient_id": data.patient_id,
        "doctor_id": doctor_id_str,
        "target_role": "patient",
        "type": "appointment_scheduled",
        "title": "Appointment Scheduled",
        "message": f"Appointment scheduled with Dr. {doctor_name} on {data.date} at {data.time}.",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })
    # Sync next appointment on the patient
    await db.patients.update_one(
        {"_id": ObjectId(data.patient_id)},
        {"$set": {
            "next_appointment": f"{data.date} at {data.time}",
            "doctor_id": doctor_id_str,
            "doctor_name": doctor_name,
        }}
    )

    return serialize_appointment(apt_doc)


@router.put("/{appointment_id}")
async def update_appointment(
    appointment_id: str,
    data: AppointmentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update appointment status or details."""
    apt = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Access check
    patient_id = apt.get("patient_id", "")
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient or str(patient["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == "doctor":
        from routes.patients import get_or_create_doctor
        doctor = await get_or_create_doctor(current_user)
        # Ensure patient is assigned to doctor
        if patient_id not in doctor.get("assigned_patients", []):
            raise HTTPException(status_code=403, detail="Access denied: patient not assigned to you")

    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if updates:
        await db.appointments.update_one(
            {"_id": ObjectId(appointment_id)}, {"$set": updates}
        )

    apt = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
    return serialize_appointment(apt)

