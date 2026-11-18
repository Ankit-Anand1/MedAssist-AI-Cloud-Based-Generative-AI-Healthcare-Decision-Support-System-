from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AppointmentCreate(BaseModel):
    patient_id: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    date: str
    time: str
    type: str = "Consultation"  # Consultation | Follow-up | Emergency | Report Review
    notes: str = ""


class Appointment(BaseModel):
    id: Optional[str] = None
    patient_id: str
    patient_name: str = ""
    doctor_id: str
    doctor_name: str = ""
    date: str
    time: str
    type: str = "Consultation"
    status: str = "Scheduled"  # Scheduled | Completed | Cancelled | In Progress
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
