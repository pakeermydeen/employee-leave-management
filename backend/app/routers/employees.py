from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Employee, User


router = APIRouter(
    prefix="/api/employees",
    tags=["Employees"]
)


@router.get("/me")
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
