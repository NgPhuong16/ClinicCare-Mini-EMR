from app.models.diagnosis import DiagnosisCode


def make_diagnosis(
    code: str = "E11.9",
    description: str = "Type 2 diabetes mellitus without complications",
) -> DiagnosisCode:
    return DiagnosisCode(code=code, description=description)
