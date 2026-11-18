from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from models.doctor_note import DoctorNoteCreate
from middleware.auth import get_current_user, require_role
from database import db

router = APIRouter(prefix="/api/doctor-notes", tags=["Doctor Notes"])


def serialize_note(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("")
async def create_note(
    data: DoctorNoteCreate,
    current_user: dict = Depends(require_role("doctor")),
):
    from routes.patients import get_or_create_doctor
    doctor = await get_or_create_doctor(current_user)

    if data.patient_id not in doctor.get("assigned_patients", []):
        await db.doctors.update_one(
            {"_id": doctor["_id"]},
            {"$addToSet": {"assigned_patients": data.patient_id}}
        )
        doctor.setdefault("assigned_patients", []).append(data.patient_id)

    note_doc = {
        "patient_id": data.patient_id,
        "doctor_id": str(doctor["_id"]),
        "doctor_name": doctor["name"],
        "content": data.content,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.doctor_notes.insert_one(note_doc)
    note_id = str(result.inserted_id)

    # Create timeline event
    await db.medical_history.insert_one(
        {
            "patient_id": data.patient_id,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "title": "Doctor Note Added",
            "description": f"Dr. {doctor['name']} added clinical notes.",
            "type": "note",
            "linked_entity_id": note_id,
        }
    )

    # Event-driven notification for patient
    await db.notifications.insert_one({
        "patient_id": data.patient_id,
        "doctor_id": str(doctor["_id"]),
        "target_role": "patient",
        "type": "note_added",
        "title": "Clinical Note Added",
        "message": f"Dr. {doctor['name']} added a new clinical note.",
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    })

    return serialize_note(note_doc)


@router.get("/{patient_id}")
async def get_notes(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all doctor notes for a patient with authorization check."""
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

    notes = []
    async for doc in db.doctor_notes.find({"patient_id": patient_id}).sort(
        "created_at", -1
    ):
        notes.append(serialize_note(doc))
    return notes

