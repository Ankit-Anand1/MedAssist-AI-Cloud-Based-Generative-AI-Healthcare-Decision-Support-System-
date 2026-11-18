from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from middleware.auth import get_current_user
from database import db

router = APIRouter(prefix="/api/doctors", tags=["Doctors"])


def serialize_doctor(doc: dict) -> dict:
    """Format doctor document to clean JSON-safe dictionary."""
    doc["id"] = str(doc.pop("_id"))
    doc.setdefault("name", "Dr. Priya Sharma")
    doc.setdefault("specialization", "Cardiology & Internal Medicine")
    doc.setdefault("hospital", "MedAssist Medical Center")
    doc.setdefault("qualification", "MBBS, MD")
    doc.setdefault("assigned_patients", [])
    return doc


@router.get("")
async def list_doctors():
    """List all registered doctors available for consultations and appointment scheduling."""
    # 1. Sync any user with role 'doctor' into db.doctors
    try:
        doctor_users = db.users.find({"role": "doctor"})
        async for u in doctor_users:
            u_id = str(u["_id"])
            existing = await db.doctors.find_one({
                "$or": [{"user_id": u_id}, {"email": u.get("email")}]
            })
            if not existing:
                name = u.get("name", "Physician")
                doc_name = name if name.startswith("Dr.") else f"Dr. {name}"
                await db.doctors.insert_one({
                    "user_id": u_id,
                    "name": doc_name,
                    "email": u.get("email"),
                    "specialization": u.get("specialty") or u.get("specialization") or "General Medicine",
                    "qualification": u.get("qualification") or "MBBS, MD",
                    "phone": u.get("phone") or "+91 98765 43210",
                    "hospital": u.get("hospital") or "MedAssist Medical Center",
                    "assigned_patients": [],
                })
    except Exception as e:
        print(f"Notice: Error syncing doctor users: {e}")

    # 2. Retrieve all doctor documents
    doctors = []
    async for doc in db.doctors.find({}):
        doctors.append(serialize_doctor(doc))

    # 3. If no doctors exist at all, populate default Dr. Priya Sharma
    if not doctors:
        default_doc = {
            "name": "Dr. Priya Sharma",
            "specialization": "Cardiology & Internal Medicine",
            "qualification": "MBBS, MD (Cardiology), DM",
            "phone": "+91 98765 43210",
            "email": "dr.priya@medcare.in",
            "hospital": "MedAssist Medical Center",
            "assigned_patients": [],
        }
        res = await db.doctors.insert_one(default_doc)
        default_doc["id"] = str(res.inserted_id)
        doctors.append(default_doc)

    return doctors


@router.get("/{doctor_id}")
async def get_doctor(doctor_id: str):
    """Get single doctor profile by ID."""
    doc = None
    if ObjectId.is_valid(doctor_id):
        try:
            doc = await db.doctors.find_one({"_id": ObjectId(doctor_id)})
        except Exception:
            pass

    if not doc:
        doc = await db.doctors.find_one({"user_id": doctor_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    return serialize_doctor(doc)

