from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DoctorProfile(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    specialization: str
    qualification: str
    phone: str
    email: str
    avatar: str = ""
    experience: int = 0
    hospital: str = ""
    assigned_patients: list[str] = []  # list of patient_ids
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class DoctorProfileUpdate(BaseModel):
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    phone: Optional[str] = None
    hospital: Optional[str] = None
    experience: Optional[int] = None
