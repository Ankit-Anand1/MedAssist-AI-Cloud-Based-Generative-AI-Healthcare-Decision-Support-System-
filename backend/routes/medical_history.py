from fastapi import APIRouter, HTTPException, Depends
from middleware.auth import get_current_user
from database import db

router = APIRouter(prefix="/api/medical-history", tags=["Medical History"])


def serialize_event(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/{patient_id}")
async def get_medical_history(
    patient_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get medical history timeline for a patient with authorization check."""
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

    events = []
    async for doc in db.medical_history.find({"patient_id": patient_id}).sort(
        "date", -1
    ):
        events.append(serialize_event(doc))
    return events

