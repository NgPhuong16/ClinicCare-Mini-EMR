"""The error envelope is the one format the frontend parses, so every failure path —
domain exceptions, request validation, routing errors, crashes — must produce it."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.main import register_exception_handlers


class _Payload(BaseModel):
    name: str = Field(min_length=1)


class _DiagnosisNotFoundError(NotFoundError):
    """Stands in for the specific not-found errors the services will raise."""

    code = "DIAGNOSIS_NOT_FOUND"


def _build_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/not-found")
    def not_found() -> None:
        raise NotFoundError("Consultation 42 does not exist")

    @app.get("/subclass-not-found")
    def subclass_not_found() -> None:
        raise _DiagnosisNotFoundError("Unknown diagnosis code: Z99.9")

    @app.get("/invalid")
    def invalid() -> None:
        raise ValidationError("Unknown diagnosis code: Z99.9")

    @app.get("/conflict")
    def conflict() -> None:
        raise ConflictError("Already exists")

    @app.get("/crash")
    def crash() -> None:
        raise RuntimeError("secret internal detail")

    @app.post("/validated")
    def validated(payload: _Payload) -> _Payload:
        return payload

    return app


@pytest.fixture
def raising_client() -> Iterator[TestClient]:
    with TestClient(_build_app(), raise_server_exceptions=False) as c:
        yield c


def test_not_found_error_maps_to_404_envelope(raising_client: TestClient) -> None:
    response = raising_client.get("/not-found")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": "Consultation 42 does not exist"}
    }


def test_domain_error_subclass_inherits_its_parents_status(raising_client: TestClient) -> None:
    # Status is resolved through the MRO. A plain type() lookup would answer 400 here.
    response = raising_client.get("/subclass-not-found")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "DIAGNOSIS_NOT_FOUND"


def test_validation_error_maps_to_422_envelope(raising_client: TestClient) -> None:
    response = raising_client.get("/invalid")

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "VALIDATION_ERROR", "message": "Unknown diagnosis code: Z99.9"}
    }


def test_conflict_error_maps_to_409_envelope(raising_client: TestClient) -> None:
    response = raising_client.get("/conflict")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_request_validation_error_is_reshaped_into_envelope(raising_client: TestClient) -> None:
    response = raising_client.post("/validated", json={"name": ""})

    assert response.status_code == 422
    body = response.json()
    assert "detail" not in body
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "body.name"


def test_unhandled_exception_returns_generic_500_envelope(raising_client: TestClient) -> None:
    response = raising_client.get("/crash")

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}
    }


def test_unknown_route_returns_404_envelope(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found"}}
