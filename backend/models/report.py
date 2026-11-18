from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MedicalReport(BaseModel):
    id: Optional[str] = None
    patient_id: str
    type: str  # 'Brain MRI' | 'X-ray' | 'ECG' | 'Blood Test' | 'Medical Report'
    title: str
    date: str
    file_url: str = ""
    file_name: str = ""
    file_size: int = 0
    processing_status: str = "Uploaded"  # Uploaded | Processing | Ready for Analysis
    status: str = "Pending"  # Pending | AI Processing | AI Analyzed | Reviewed | Flagged
    ai_confidence: Optional[float] = None
    findings: list[str] = []
    summary: Optional[str] = None
    doctor_notes: Optional[str] = None
    urgency: str = "Normal"  # Normal | Moderate | High | Critical
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class ReportCreate(BaseModel):
    type: str
    title: str
