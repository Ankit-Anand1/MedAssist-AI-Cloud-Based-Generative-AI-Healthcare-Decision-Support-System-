from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Medicine(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str = ""


class PrescriptionCreate(BaseModel):
    patient_id: str
    diagnosis: str
    medicines: list[Medicine]
    notes: str = ""
    follow_up_date: str = ""


class Prescription(BaseModel):
    id: Optional[str] = None
    patient_id: str
    doctor_id: str
    doctor_name: str
    date: str
    diagnosis: str
    medicines: list[Medicine]
    notes: str = ""
    follow_up_date: str = ""
    status: str = "Active"  # Active | Completed | Draft
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
