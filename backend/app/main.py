from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, employees, leaves, manager, documents

app = FastAPI(
    title="Employee Leave Management API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(leaves.router)
app.include_router(manager.router)
app.include_router(documents.router)
@app.get("/")
def root():
    return {
        "application": "Employee Leave Management System",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/debug/jwt")
def debug_jwt():
    from app.auth import SECRET_KEY

    return {
        "secret_loaded": bool(SECRET_KEY),
        "using_default": SECRET_KEY == "change-this-secret-key"
    }
