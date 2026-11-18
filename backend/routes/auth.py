import re
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from middleware.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from database import db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user (patient or doctor) and persist across sessions."""
    normalized_email = user_data.email.strip().lower()
    clean_name = user_data.name.strip()

    # Check if a user with this email already exists (case-insensitive check)
    existing = await db.users.find_one({
        "$or": [
            {"email": normalized_email},
            {"email": {"$regex": f"^{re.escape(normalized_email)}$", "$options": "i"}}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please sign in instead.",
        )

    # 1. Insert into db.users
    user_doc = {
        "email": normalized_email,
        "name": clean_name,
        "role": user_data.role,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # 2. Insert into respective patient or doctor collection
    assigned_doc_id = None
    assigned_doc_name = None

    if user_data.role == "patient":
        # Resolve patient demographics
        raw_age = getattr(user_data, "age", 0)
        try:
            patient_age = int(raw_age) if raw_age else 0
        except Exception:
            patient_age = 0

        patient_gender = getattr(user_data, "gender", None) or "Other"
        patient_blood = (getattr(user_data, "blood_group", None) or "").strip()
        patient_phone = (user_data.phone or "").strip()

        # Parse allergies (string or list)
        raw_allergies = getattr(user_data, "allergies", None)
        allergies_list = []
        if isinstance(raw_allergies, list):
            allergies_list = [str(a).strip() for a in raw_allergies if str(a).strip()]
        elif isinstance(raw_allergies, str) and raw_allergies.strip():
            allergies_list = [a.strip() for a in raw_allergies.split(",") if a.strip()]

        # Resolve attending doctor if specified
        req_doc_id = (user_data.assigned_doctor_id or "").strip()
        req_doc_name = (user_data.assigned_doctor_name or "").strip()

        matched_doc = None
        if req_doc_id:
            if ObjectId.is_valid(req_doc_id):
                matched_doc = await db.doctors.find_one({"_id": ObjectId(req_doc_id)})
            if not matched_doc:
                matched_doc = await db.doctors.find_one({"user_id": req_doc_id})
        if not matched_doc and req_doc_name:
            matched_doc = await db.doctors.find_one({
                "name": {"$regex": f"^{re.escape(req_doc_name)}$", "$options": "i"}
            })

        if matched_doc:
            assigned_doc_id = str(matched_doc["_id"])
            assigned_doc_name = matched_doc.get("name", req_doc_name)
        elif req_doc_name:
            assigned_doc_name = req_doc_name
            assigned_doc_id = req_doc_id

        pat_doc = {
            "user_id": user_id,
            "name": clean_name,
            "age": patient_age,
            "gender": patient_gender,
            "blood_group": patient_blood,
            "phone": patient_phone,
            "email": normalized_email,
            "address": "",
            "emergency_contact": "",
            "allergies": allergies_list,
            "drug_allergies": [],
            "conditions": [],
            "avatar": "",
            "last_visit": "",
            "next_appointment": "",
            "status": "Active",
            "assigned_doctor_id": assigned_doc_id or "",
            "assigned_doctor_name": assigned_doc_name or "",
            "doctor_id": assigned_doc_id or "",
            "doctor_name": assigned_doc_name or "",
            "created_at": datetime.utcnow().isoformat(),
        }
        pat_result = await db.patients.insert_one(pat_doc)
        patient_obj_id = str(pat_result.inserted_id)

        # Automatically append the new patient's ID to the chosen doctor's assigned_patients list
        if matched_doc:
            doctor_query_or = [{"_id": matched_doc["_id"]}]
            if matched_doc.get("user_id"):
                doctor_query_or.append({"user_id": str(matched_doc["user_id"])})
            if matched_doc.get("name"):
                doctor_query_or.append({"name": {"$regex": f"^{re.escape(matched_doc['name'])}$", "$options": "i"}})
            await db.doctors.update_many(
                {"$or": doctor_query_or},
                {"$addToSet": {"assigned_patients": patient_obj_id}}
            )

    elif user_data.role == "doctor":
        spec = user_data.specialization or user_data.specialty or "General Medicine"
        doc_name = clean_name if clean_name.startswith("Dr.") else f"Dr. {clean_name}"
        await db.doctors.insert_one({
            "user_id": user_id,
            "name": doc_name,
            "specialization": spec,
            "qualification": user_data.qualification or "MBBS, MD",
            "phone": user_data.phone or "+91 98765 43210",
            "email": normalized_email,
            "avatar": "",
            "experience": 5,
            "hospital": user_data.hospital or "MedAssist Medical Center",
            "assigned_patients": [],
            "created_at": datetime.utcnow().isoformat(),
        })

    # 3. If in mock mode, flush to disk store immediately
    if db.is_mock:
        await db.persist_mock()

    token = create_access_token({
        "sub": user_id,
        "email": normalized_email,
        "name": clean_name,
        "role": user_data.role,
    })

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=normalized_email,
            name=clean_name,
            role=user_data.role,
            created_at=user_doc["created_at"],
            assigned_doctor_id=assigned_doc_id,
            assigned_doctor_name=assigned_doc_name,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Authenticate user and return JWT token."""
    normalized_email = credentials.email.strip().lower()

    # Find user with exact normalized match or case-insensitive regex
    user = await db.users.find_one({
        "$or": [
            {"email": normalized_email},
            {"email": {"$regex": f"^{re.escape(normalized_email)}$", "$options": "i"}}
        ]
    })

    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token = create_access_token({
        "sub": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
    })

    assigned_doc_id = None
    assigned_doc_name = None
    if user["role"] == "patient":
        pat = await db.patients.find_one({"$or": [{"user_id": user_id}, {"email": user["email"]}]})
        if pat:
            assigned_doc_id = str(pat.get("assigned_doctor_id") or pat.get("doctor_id") or "")
            assigned_doc_name = pat.get("assigned_doctor_name") or pat.get("doctor_name")

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            name=user["name"],
            role=user["role"],
            created_at=str(user.get("created_at", "")),
            assigned_doctor_id=assigned_doc_id,
            assigned_doctor_name=assigned_doc_name,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user info."""
    user = None
    if ObjectId.is_valid(current_user["id"]):
        user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        user = await db.users.find_one({"email": current_user.get("email")})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    assigned_doc_id = None
    assigned_doc_name = None
    if user["role"] == "patient":
        user_id = str(user["_id"])
        pat = await db.patients.find_one({"$or": [{"user_id": user_id}, {"email": user["email"]}]})
        if pat:
            assigned_doc_id = str(pat.get("assigned_doctor_id") or pat.get("doctor_id") or "")
            assigned_doc_name = pat.get("assigned_doctor_name") or pat.get("doctor_name")

    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=str(user.get("created_at", "")),
        assigned_doctor_id=assigned_doc_id,
        assigned_doctor_name=assigned_doc_name,
    )


@router.get("/doctors")
async def get_public_doctors():
    """Public unauthenticated endpoint to list available doctors for registration."""
    from routes.doctors import list_doctors
    return await list_doctors()
