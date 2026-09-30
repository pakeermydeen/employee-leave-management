from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_manager
from ..models import LeaveRequest, User


router = APIRouter(
    prefix="/api/manager",
    tags=["Manager"]
)


class LeaveDecision(BaseModel):
    status: str
    manager_comment: str | None = None

@router.get("/dashboard")
def get_manager_dashboard(
    current_manager: User = Depends(get_current_manager),
    db: Session = Depends(get_db)
):
    # Get all leave requests
    leave_requests = (
        db.query(LeaveRequest)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    # Calculate request statistics
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

    # Get recent pending requests
    pending_requests = [
        {
            "leave_request_id": leave.id,
            "employee_id": leave.employee_id,
            "leave_type_id": leave.leave_type_id,
            "from_date": leave.from_date,
            "to_date": leave.to_date,
            "reason": leave.reason,
            "status": leave.status,
            "created_at": leave.created_at
        }
        for leave in leave_requests
        if leave.status == "pending"
    ][:5]

    return {
        "manager": {
            "user_id": current_manager.id,
            "username": current_manager.username,
            "email": current_manager.email,
            "role": current_manager.role
        },
        "leave_summary": {
            "total_requests": total_requests,
            "pending": pending_count,
            "approved": approved_count,
            "rejected": rejected_count
        },
        "recent_pending_requests": pending_requests
    }
@router.get("/leaves")
def get_pending_leave_requests(
    current_manager: User = Depends(get_current_manager),
    db: Session = Depends(get_db)
):
    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == "pending")
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [
        {
            "leave_request_id": leave.id,
            "employee_id": leave.employee_id,
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


@router.put("/leaves/{leave_id}")
def update_leave_request(
    leave_id: int,
    decision: LeaveDecision,
    current_manager: User = Depends(get_current_manager),
    db: Session = Depends(get_db)
):
    if decision.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be approved or rejected"
        )

    leave_request = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.id == leave_id)
        .first()
    )

    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found"
        )

    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be updated"
        )

    leave_request.status = decision.status
    leave_request.manager_comment = decision.manager_comment

    db.commit()
    db.refresh(leave_request)

    return {
        "message": "Leave request updated successfully",
        "leave_request_id": leave_request.id,
        "status": leave_request.status,
        "manager_comment": leave_request.manager_comment
    }
