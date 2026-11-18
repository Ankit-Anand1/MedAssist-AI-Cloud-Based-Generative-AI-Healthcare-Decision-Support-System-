from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PatientCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = "patient123"
    age: int = 0
    gender: str = "Other"
    blood_group: str = ""
    phone: str = ""
    address: str = ""
    emergency_contact: str = ""
    allergies: list[str] = []
    conditions: list[str] = []


class PatientProfile(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    age: int
    gender: str = Field(..., pattern="^(Male|Female|Other)$")
    blood_group: str
    phone: str
    email: str
    address: str
    emergency_contact: str = ""
    allergies: list[str] = []
    conditions: list[str] = []
    avatar: str = ""
    last_visit: str = ""
    next_appointment: str = ""
    status: str = "Active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class PatientProfileUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    allergies: Optional[list[str]] = None


class VitalSign(BaseModel):
    patient_id: str
    date: str
    blood_pressure: str
    heart_rate: int
    temperature: float
    oxygen_saturation: int
    glucose: int
    weight: float
