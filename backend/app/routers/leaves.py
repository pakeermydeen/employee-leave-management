from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Employee, LeaveRequest, User


router = APIRouter(
    prefix="/api/leaves",
    tags=["Leaves"]
)


class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    from_date: date
    to_date: date
    reason: str | None = None


@router.post("/")
def create_leave_request(
    request: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )

    if request.from_date > request.to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="From date cannot be after to date"
        )

    leave_request = LeaveRequest(
        employee_id=employee.id,
        leave_type_id=request.leave_type_id,
        from_date=request.from_date,
        to_date=request.to_date,
        reason=request.reason,
        status="pending"
    )

    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)

    return {
        "message": "Leave request submitted successfully",
        "leave_request_id": leave_request.id,
        "employee_id": employee.id,
        "leave_type_id": leave_request.leave_type_id,
        "from_date": leave_request.from_date,
        "to_date": leave_request.to_date,
        "reason": leave_request.reason,
        "status": leave_request.status
    }


@router.get("/my")
def get_my_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    employee = (
        db.query(Employee)
        .filter(Employee.user_id == current_user.id)
        .first()
    )

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )

    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [
        {
            "leave_request_id": leave.id,
            "leave_type_id": leave.leave_type_id,
            "from_date": leave.from_date,
            "to_date": leave.to_date,
            "reason": leave.reason,
            "status": leave.status,
            "manager_comment": leave.manager_comment,
            "created_at": leave.created_at
        }
        for leave in leave_requests
    ]
