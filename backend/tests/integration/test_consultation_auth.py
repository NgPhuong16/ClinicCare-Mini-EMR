"""Cookie-auth protection on the consultations router. Business behaviour of the
endpoints themselves lives in test_consultation_api.py."""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.doctor import Doctor

URL = "/api/v1/consultations"


def test_list_without_cookie_returns_401_envelope(client: TestClient) -> None:
    response = client.get(URL)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_create_without_cookie_returns_401_envelope(client: TestClient) -> None:
    response = client.post(URL, json={"patient_name": "Nguyen An", "diagnosis_codes": ["E11.9"]})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_list_with_garbage_cookie_returns_401(client: TestClient) -> None:
    client.cookies.set(settings.auth_cookie_name, "garbage")

    response = client.get(URL)

    assert response.status_code == 401


def test_list_with_expired_token_returns_401(client: TestClient) -> None:
    now = datetime.now(UTC)
    expired_token = jwt.encode(
        {"sub": "1", "iat": now - timedelta(hours=2), "exp": now - timedelta(hours=1)},
        settings.jwt_secret.get_secret_value(),
        algorithm=ALGORITHM,
    )
    client.cookies.set(settings.auth_cookie_name, expired_token)

    response = client.get(URL)

    assert response.status_code == 401


def test_list_with_token_signed_by_a_different_secret_returns_401(client: TestClient) -> None:
    now = datetime.now(UTC)
    forged_token = jwt.encode(
        {"sub": "1", "iat": now, "exp": now + timedelta(hours=1)},
        "a-different-secret-that-is-long-enough",
        algorithm=ALGORITHM,
    )
    client.cookies.set(settings.auth_cookie_name, forged_token)

    response = client.get(URL)

    assert response.status_code == 401


def test_list_with_token_for_deleted_doctor_returns_401(
    auth_client: TestClient, doctor: Doctor, db: Session
) -> None:
    db.delete(doctor)
    db.commit()

    response = auth_client.get(URL)

    assert response.status_code == 401


def test_list_with_valid_cookie_returns_200(auth_client: TestClient) -> None:
    response = auth_client.get(URL)

    assert response.status_code == 200
