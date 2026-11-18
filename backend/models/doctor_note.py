from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DoctorNoteCreate(BaseModel):
    patient_id: str
    content: str


class DoctorNote(BaseModel):
    id: Optional[str] = None
    patient_id: str
    doctor_id: str
    doctor_name: str = ""
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
