from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import create_token, hash_password, verify_password
from ..database import get_db
from ..dependencies import get_current_user
from ..models import Employee, User
from ..schemas import LoginRequest, RegisterRequest


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = (
        db.query(User)
        .filter(
            (User.username == request.username)
            | (User.email == request.email)
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )

    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        role=request.role
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    employee = Employee(
        user_id=user.id,
        full_name=request.full_name
    )

    db.add(employee)
    db.commit()

    token = create_token(
        user_id=user.id,
        role=user.role
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role
    }


@router.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(User.username == request.username)
        .first()
    )

    if not user or not verify_password(
        request.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_token(
        user_id=user.id,
        role=user.role
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role
    }


@router.get("/me")
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    }
