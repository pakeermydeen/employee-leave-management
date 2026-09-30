from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Employee, User, LeaveRequest, LeaveType


router = APIRouter(
    prefix="/api/employees",
    tags=["Employees"]
)


@router.get("/me")
@router.get("/dashboard")
def get_employee_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find employee profile
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

    # Get all leave requests for this employee
    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == employee.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    # Calculate leave request summary
    total_requests = len(leave_requests)

    pending_count = sum(
        1 for leave in leave_requests
        if leave.status == "pending"
    )

    approved_count = sum(
        1 for leave in leave_requests
        if leave.status == "approved"
    )

    rejected_count = sum(
        1 for leave in leave_requests
        if leave.status == "rejected"
    )

    # Get recent requests
    recent_requests = []

    for leave in leave_requests[:5]:
        recent_requests.append({
            "leave_request_id": leave.id,
            "leave_type_id": leave.leave_type_id,
            "from_date": leave.from_date,
            "to_date": leave.to_date,
            "reason": leave.reason,
            "status": leave.status,
            "manager_comment": leave.manager_comment,
            "created_at": leave.created_at
        })

    return {
        "employee": {
            "employee_id": employee.id,
            "user_id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": employee.full_name,
            "role": current_user.role
        },
        "leave_summary": {
            "total_requests": total_requests,
            "pending": pending_count,
            "approved": approved_count,
            "rejected": rejected_count
        },
        "recent_requests": recent_requests
    }
def get_my_employee_profile(
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

    return {
        "employee_id": employee.id,
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": employee.full_name,
        "role": current_user.role
    }
