from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Employee, LeaveRequest, LeaveType, User


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

    # Find leave type
    leave_type = (
        db.query(LeaveType)
        .filter(LeaveType.id == request.leave_type_id)
        .first()
    )

    if leave_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave type not found"
        )

    # Validate dates
    if request.from_date > request.to_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="From date cannot be after to date"
        )

    # Calculate requested leave days
    requested_days = (
        request.to_date - request.from_date
    ).days + 1
    # Check for overlapping pending or approved leave requests
    overlapping_leave = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.leave_type_id == request.leave_type_id,
            LeaveRequest.status.in_(["pending", "approved"]),
            LeaveRequest.from_date <= request.to_date,
            LeaveRequest.to_date >= request.from_date
        )
        .first()
    )

    if overlapping_leave:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Leave request overlaps with an existing "
                "pending or approved leave request"
            )
        )

    # Calculate already used approved leave days
    approved_leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.leave_type_id == request.leave_type_id,
            LeaveRequest.status == "approved"
        )
        .all()
    )

    used_days = sum(
        (leave.to_date - leave.from_date).days + 1
        for leave in reserved_leaves
    )

    # Calculate remaining leave balance
    remaining_days = leave_type.default_days - used_days

    # Check remaining leave balance
    if requested_days > remaining_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient leave balance. "
                f"Used: {used_days} days, "
                f"Remaining: {remaining_days} days, "
                f"Requested: {requested_days} days"
            )
        )

    # Create leave request
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
        "requested_days": requested_days,
        "used_days": used_days,
        "remaining_days": remaining_days - requested_days,
        "allowed_days": leave_type.default_days,
        "reason": leave_request.reason,
        "status": leave_request.status
    }


@router.get("/balance")
def get_leave_balance(
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

    # Get all leave types
    leave_types = (
        db.query(LeaveType)
        .order_by(LeaveType.id)
        .all()
    )

    balances = []

    for leave_type in leave_types:

        # Get approved and pending leave requests
        reserved_leaves = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.employee_id == employee.id,
                LeaveRequest.leave_type_id == leave_type.id,
                LeaveRequest.status.in_(["approved", "pending"])
            )
            .all()
        )

        # Calculate reserved days
        reserved_days = sum(
            (leave.to_date - leave.from_date).days + 1
            for leave in reserved_leaves
        )

        # Calculate remaining days
        remaining_days = max(
            leave_type.default_days - reserved_days,
            0
        )
        # Calculate used days
        used_days = sum(
            (leave.to_date - leave.from_date).days + 1
            for leave in approved_leaves
        )

        balances.append({
            "leave_type_id": leave_type.id,
            "leave_type": leave_type.name,
            "allowed_days": leave_type.default_days,
            "used_days": reserved_days,
            "remaining_days": remaining_days
        })

    return {
        "employee_id": employee.id,
	        "balances": balances
    }


@router.get("/my")
def get_my_leave_requests(
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

    # Get employee leave requests
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
