from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: str = Field(...)
    license_no: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class OTPVerify(BaseModel):
    temp_token: str
    otp: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    expires_at: datetime


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None
    redirectTo: Optional[str] = None
    otp_required: bool = False
    temp_token: Optional[str] = None
    expires_at: Optional[datetime] = None
