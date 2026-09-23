from fastapi import APIRouter

from app.api.v1.consultation import router as consultation_router
from app.api.v1.diagnosis import router as diagnosis_router

router = APIRouter()
router.include_router(diagnosis_router)
router.include_router(consultation_router)
