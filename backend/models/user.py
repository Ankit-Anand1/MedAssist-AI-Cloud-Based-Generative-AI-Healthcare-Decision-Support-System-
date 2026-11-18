from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional, Any, Union
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    full_name: Optional[str] = None
    role: str = Field(..., pattern="^(patient|doctor)$")
    specialty: Optional[str] = "General Medicine"
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[Union[int, str]] = None
    gender: Optional[str] = "Other"
    blood_group: Optional[str] = None
    allergies: Optional[Any] = None
    assigned_doctor_id: Optional[str] = None
    assigned_doctor_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_name(cls, data):
        if isinstance(data, dict):
            name_val = data.get("name") or data.get("full_name")
            if name_val:
                data["name"] = name_val
                data["full_name"] = name_val
        return data

    @model_validator(mode="after")
    def validate_name(self):
        if not self.name or len(self.name.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserInDB(BaseModel):
    id: Optional[str] = None
    email: str
    name: str
    role: str
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str
    assigned_doctor_id: Optional[str] = None
    assigned_doctor_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
