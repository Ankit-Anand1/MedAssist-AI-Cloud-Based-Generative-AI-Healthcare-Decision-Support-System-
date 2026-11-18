from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TimelineEvent(BaseModel):
    id: Optional[str] = None
    patient_id: str
    date: str
    title: str
    description: str
    type: str  # diagnosis | prescription | report | visit | surgery | note
    linked_entity_id: Optional[str] = None  # ID of related report/prescription/etc.
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}
