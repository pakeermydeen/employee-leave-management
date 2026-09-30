import os
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Document, Employee, LeaveRequest, User


router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"]
)


S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION
)


@router.post("/upload")
def upload_document(
    leave_request_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check S3 configuration
    if not S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket is not configured"
        )

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

    # Find leave request
    leave_request = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.id == leave_request_id,
            LeaveRequest.employee_id == employee.id
        )
        .first()
    )

    if leave_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found"
        )

    # Validate file name
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is required"
        )

    # Generate unique S3 object key
    safe_file_name = os.path.basename(file.filename)
    unique_name = f"{uuid.uuid4()}-{safe_file_name}"

    s3_key = (
        f"employees/{employee.id}/"
        f"leave-requests/{leave_request.id}/"
        f"{unique_name}"
    )

    try:
        # Upload file to S3
        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET_NAME,
            s3_key
        )

    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document to S3"
        ) from exc

    # Save document metadata
    document = Document(
        employee_id=employee.id,
        leave_request_id=leave_request.id,
        file_name=safe_file_name,
        s3_key=s3_key
    )

    try:
        db.add(document)
        db.commit()
        db.refresh(document)

    except Exception as exc:
        db.rollback()

        # Remove S3 object if database save fails
        try:
            s3_client.delete_object(
                Bucket=S3_BUCKET_NAME,
                Key=s3_key
            )
        except (BotoCoreError, ClientError):
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save document metadata"
        ) from exc

    return {
        "message": "Document uploaded successfully",
        "document_id": document.id,
        "employee_id": document.employee_id,
        "leave_request_id": document.leave_request_id,
        "file_name": document.file_name,
        "s3_key": document.s3_key,
        "uploaded_at": document.uploaded_at
    }

@router.get("/my")
def list_my_documents(
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

    # Get documents belonging to this employee
    documents = (
        db.query(Document)
        .filter(Document.employee_id == employee.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    return {
        "employee_id": employee.id,
        "documents": [
            {
                "document_id": document.id,
                "leave_request_id": document.leave_request_id,
                "file_name": document.file_name,
                "s3_key": document.s3_key,
                "uploaded_at": document.uploaded_at
            }
            for document in documents
        ]
    }
@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check S3 configuration
    if not S3_BUCKET_NAME:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket is not configured"
        )

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

    # Find document belonging to this employee
    document = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.employee_id == employee.id
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    try:
        # Generate temporary download URL
        download_url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": document.s3_key
            },
            ExpiresIn=300
        )

    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        ) from exc

    return {
        "document_id": document.id,
        "file_name": document.file_name,
        "download_url": download_url,
        "expires_in": 300
    }
