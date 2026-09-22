from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.diagnosis import DiagnosisCode
from app.schemas.diagnosis import DiagnosisRead
from app.services import diagnosis as diagnosis_service

router = APIRouter(prefix="/diagnoses", tags=["diagnoses"])


@router.get("", response_model=list[DiagnosisRead])
def search_diagnoses(
    search: str = Query(max_length=100, description="Matched against code and description"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[DiagnosisCode]:
    return diagnosis_service.search(db, search, limit)
