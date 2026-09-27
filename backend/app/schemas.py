from datetime import date
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "employee"


class LoginRequest(BaseModel):
    username: str
    password: str


class LeaveCreate(BaseModel):
    leave_type_id: int
    from_date: date
    to_date: date
    reason: str | None = None


class LeaveDecision(BaseModel):
    manager_comment: str | None = None
