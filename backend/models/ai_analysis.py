from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Finding(BaseModel):
    label: str
    value: str
    status: str  # Normal | Abnormal | Critical | Borderline
    detail: Optional[str] = None


class AIAnalysisResult(BaseModel):
    id: Optional[str] = None
    report_id: str
    patient_id: str = ""
    type: str  # Brain MRI | X-ray | ECG | Blood Test | Medical Report
    modality: str = ""  # Normalized modality identifier
    model_name: str
    model_type: str
    confidence: float
    findings: list[Finding] = []
    summary: str = ""
    recommendations: list[str] = []
    output_image_url: str = ""  # URL to AI-generated output image
    processed_at: str = ""
    status: str = "Completed"  # Completed | Processing | Error
    error_message: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class LabValue(BaseModel):
    id: Optional[str] = None
    patient_id: str
    report_id: str
    name: str
    value: Optional[float] = None
    unit: str
    reference_range: str
    status: str  # Normal | Low | High | Critical | Not determined
    extraction_note: str = ""


class ResearchEvidence(BaseModel):
    id: Optional[str] = None
    title: str
    authors: str
    journal: str
    year: int
    doi: str
    relevance: str
    summary: str


class AIPatientBrief(BaseModel):
    id: Optional[str] = None
    patient_id: str
    patient_info: dict = {}
    symptoms: list[str] = []
    current_reports: list[dict] = []
    mri_findings: list[str] = []
    xray_findings: list[str] = []
    ecg_findings: list[str] = []
    blood_report_abnormalities: list[str] = []
    previous_prescriptions: list[str] = []
    important_observations: list[str] = []
    generated_at: str = ""
