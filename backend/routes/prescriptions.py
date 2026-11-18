from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from models.prescription import PrescriptionCreate
from middleware.auth import get_current_user, require_role
from database import db

router = APIRouter(prefix="/api/prescriptions", tags=["Prescriptions"])


def serialize_prescription(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("")
async def create_prescription(
    data: PrescriptionCreate,
    current_user: dict = Depends(require_role("doctor")),
):
    from routes.patients import get_or_create_doctor
    doctor = await get_or_create_doctor(current_user)

    # Validate patient exists
    patient = await db.patients.find_one({"_id": ObjectId(data.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if data.patient_id not in doctor.get("assigned_patients", []):
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": data.patient_id}}
        )
        doctor.setdefault("assigned_patients", []).append(data.patient_id)

    rx_doc = {
        "patient_id": data.patient_id,
        "doctor_id": str(doctor["_id"]),
        "doctor_name": doctor["name"],
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "diagnosis": data.diagnosis,
        "medicines": [m.model_dump() for m in data.medicines],
        "notes": data.notes,
        "follow_up_date": data.follow_up_date,
        "status": "Active",
    }
    result = await db.prescriptions.insert_one(rx_doc)
    rx_id = str(result.inserted_id)

    # Create timeline event
    med_names = ", ".join([m.name for m in data.medicines])
    await db.medical_history.insert_one(
        {
            "patient_id": data.patient_id,
            "date": rx_doc["date"],
            "title": "Prescription Created",
            "description": f"Dr. {doctor['name']} prescribed {med_names}. Diagnosis: {data.diagnosis}",
            "type": "prescription",
            "linked_entity_id": rx_id,
        }
    )

    # Create event-driven notification for the patient
    await db.notifications.insert_one({
        "patient_id": data.patient_id,
        "doctor_id": str(doctor["_id"]),
        "target_role": "patient",
        "type": "prescription_created",
        "title": "New Prescription Issued",
        "message": f"Dr. {doctor['name']} issued a prescription for {data.diagnosis} ({med_names}).",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })

    # Create follow-up timeline event if date specified
    if data.follow_up_date:
        await db.medical_history.insert_one(
            {
                "patient_id": data.patient_id,
                "date": data.follow_up_date,
                "title": "Follow-up Scheduled",
                "description": f"Follow-up with Dr. {doctor['name']} for {data.diagnosis}",
                "type": "visit",
                "linked_entity_id": rx_id,
            }
        )

    return serialize_prescription(rx_doc)


@router.get("")
async def list_prescriptions(
    current_user: dict = Depends(get_current_user),
):
    """List prescriptions. Patient sees own; doctor sees all assigned."""
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient:
            return []
        cursor = db.prescriptions.find({"patient_id": str(patient["_id"])}).sort("date", -1)
    else:
        from routes.patients import get_or_create_doctor, get_doctor_assigned_patient_ids
        doctor = await get_or_create_doctor(current_user)
        assigned = await get_doctor_assigned_patient_ids(doctor, current_user)
        doctor_id_str = str(doctor["_id"])
        user_id_str = str(current_user["id"])
        
        rx_or = [{"doctor_id": {"$in": [doctor_id_str, user_id_str]}}]
        if assigned:
            rx_or.append({"patient_id": {"$in": assigned}})
        cursor = db.prescriptions.find({"$or": rx_or}).sort("date", -1)

    prescriptions = []
    async for doc in cursor:
        prescriptions.append(serialize_prescription(doc))
    return prescriptions


@router.get("/{prescription_id}")
async def get_prescription(
    prescription_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single prescription with authorization check."""
    rx = await db.prescriptions.find_one({"_id": ObjectId(prescription_id)})
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    patient_id = rx.get("patient_id", "")
    if current_user["role"] == "patient":
        patient = await db.patients.find_one({"user_id": current_user["id"]})
        if not patient or str(patient["_id"]) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user["role"] == "doctor":
        from routes.patients import get_or_create_doctor
        doctor = await get_or_create_doctor(current_user)
        if patient_id and patient_id not in doctor.get("assigned_patients", []):
            await db.doctors.update_one(
                {"_id": doctor["_id"]},
                {"$addToSet": {"assigned_patients": patient_id}}
            )
            doctor.setdefault("assigned_patients", []).append(patient_id)

    return serialize_prescription(rx)
