
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.questions import router as questions_router

app = FastAPI(
    title="VivaAI API",
    description="AI-powered viva and interview backend",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(questions_router)


@app.get("/")
def root():
    return {"message": "VivaAI Backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
