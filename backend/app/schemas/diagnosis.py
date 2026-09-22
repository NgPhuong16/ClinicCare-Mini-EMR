from pydantic import BaseModel, ConfigDict, Field


class DiagnosisBase(BaseModel):
    code: str = Field(min_length=1, max_length=10)
    description: str = Field(min_length=1)


class DiagnosisRead(DiagnosisBase):
    # No DiagnosisCreate: codes are static reference data loaded from the seed file and
    # never written through the API.
    model_config = ConfigDict(from_attributes=True)
