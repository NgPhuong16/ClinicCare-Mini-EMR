from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.consultation import Consultation
from app.schemas.consultation import ConsultationCreate, ConsultationRead
from app.services import consultation as consultation_service

router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.post("", response_model=ConsultationRead, status_code=201)
def create_consultation(
    payload: ConsultationCreate,
    db: Session = Depends(get_db),
) -> Consultation:
    return consultation_service.create(db, payload)


@router.get("", response_model=list[ConsultationRead])
def list_consultations(
    patient: str | None = Query(default=None, max_length=200),
    code: str | None = Query(default=None, max_length=10),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Consultation]:
    return consultation_service.list_(db, patient=patient, code=code, limit=limit, offset=offset)
