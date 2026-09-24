from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.doctor import Doctor
from tests.factories import DEFAULT_DOCTOR_PASSWORD

URL = "/api/v1/auth"


def test_login_success_returns_doctor_and_sets_httponly_cookie(
    client: TestClient, doctor: Doctor
) -> None:
    response = client.post(
        f"{URL}/login", json={"email": doctor.email, "password": DEFAULT_DOCTOR_PASSWORD}
    )

    assert response.status_code == 200
    assert response.json() == {"id": doctor.id, "email": doctor.email}
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert settings.auth_cookie_name.lower() in set_cookie


def test_login_response_body_carries_no_token(client: TestClient, doctor: Doctor) -> None:
    response = client.post(
        f"{URL}/login", json={"email": doctor.email, "password": DEFAULT_DOCTOR_PASSWORD}
    )

    assert set(response.json().keys()) == {"id", "email"}


def test_login_wrong_password_returns_401(client: TestClient, doctor: Doctor) -> None:
    response = client.post(f"{URL}/login", json={"email": doctor.email, "password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "UNAUTHORIZED", "message": "Invalid email or password"}
    }


def test_login_unknown_email_returns_identical_401_envelope(
    client: TestClient, doctor: Doctor
) -> None:
    response = client.post(
        f"{URL}/login", json={"email": "nobody@example.com", "password": "whatever"}
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "UNAUTHORIZED", "message": "Invalid email or password"}
    }


def test_login_email_is_case_and_space_insensitive(client: TestClient, doctor: Doctor) -> None:
    response = client.post(
        f"{URL}/login",
        json={"email": f"  {doctor.email.upper()}  ", "password": DEFAULT_DOCTOR_PASSWORD},
    )

    assert response.status_code == 200


def test_me_with_cookie_returns_doctor(auth_client: TestClient, doctor: Doctor) -> None:
    response = auth_client.get(f"{URL}/me")

    assert response.status_code == 200
    assert response.json() == {"id": doctor.id, "email": doctor.email}


def test_me_without_cookie_returns_401_envelope(client: TestClient) -> None:
    response = client.get(f"{URL}/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_logout_clears_cookie(auth_client: TestClient) -> None:
    response = auth_client.post(f"{URL}/logout")

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"].lower()
    assert "max-age=0" in set_cookie or "expires=" in set_cookie


def test_logout_then_me_returns_401(auth_client: TestClient) -> None:
    auth_client.post(f"{URL}/logout")

    response = auth_client.get(f"{URL}/me")

    assert response.status_code == 401


def test_logout_without_cookie_returns_204(client: TestClient) -> None:
    response = client.post(f"{URL}/logout")

    assert response.status_code == 204
