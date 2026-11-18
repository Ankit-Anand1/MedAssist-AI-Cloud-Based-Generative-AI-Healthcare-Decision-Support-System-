"""
Doctor Settings API — profile retrieval and update.

Reads from the doctor profile in MongoDB, never uses hardcoded values.
"""

from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from middleware.auth import require_role, get_current_user
from database import db

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the current user's profile from MongoDB."""
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
    }

    # If doctor, fetch extended profile
    if user.get("role") == "doctor":
        doctor = await db.doctors.find_one({"user_id": current_user["id"]})
        if doctor:
            profile.update({
                "specialization": doctor.get("specialization", ""),
                "qualification": doctor.get("qualification", ""),
                "phone": doctor.get("phone", ""),
                "hospital": doctor.get("hospital", ""),
                "experience": doctor.get("experience", 0),
            })
        else:
            profile.update({
                "specialization": "",
                "qualification": "",
                "phone": "",
                "hospital": "",
                "experience": 0,
            })

    return profile


@router.put("/profile")
async def update_profile(
    updates: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update the current user's profile in MongoDB."""
    user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update base user fields
    user_updates = {}
    if "name" in updates and updates["name"].strip():
        user_updates["name"] = updates["name"].strip()

    if user_updates:
        await db.users.update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": user_updates},
        )

    # Update doctor profile fields
    if user.get("role") == "doctor":
        doctor_updates = {}
        for field in ("specialization", "qualification", "phone", "hospital"):
            if field in updates:
                doctor_updates[field] = updates[field]
        if "experience" in updates:
            doctor_updates["experience"] = int(updates["experience"])
        if "name" in updates:
            doctor_updates["name"] = updates["name"].strip()

        if doctor_updates:
            await db.doctors.update_one(
                {"user_id": current_user["id"]},
                {"$set": doctor_updates},
                upsert=True,
            )

    # Return updated profile
    return await get_profile(current_user)
