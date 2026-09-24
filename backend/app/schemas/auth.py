from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    # Not EmailStr: pydantic's email validator rejects doctor@cliniccare.local as a
    # "special-use or reserved name", and a format check adds nothing on a login endpoint —
    # a wrong-format email just fails to match on lookup, same as any other unknown email.
    email: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=200)


class DoctorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
