from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.consultation import Consultation
from tests.factories import make_consultation, make_diagnosis

URL = "/api/v1/consultations"


@pytest.fixture
def codes(db: Session) -> None:
    db.add_all(
        [
            make_diagnosis("E11.9", "Type 2 diabetes mellitus without complications"),
            make_diagnosis("I10", "Essential (primary) hypertension"),
            make_diagnosis("J45.20", "Mild intermittent asthma, uncomplicated"),
        ]
    )
    db.commit()


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "patient_name": "Nguyen An",
        "notes": "Routine follow-up",
        "diagnosis_codes": ["E11.9", "I10"],
    }
    payload.update(overrides)
    return payload


def test_create_returns_201_with_attached_codes(client: TestClient, codes: None) -> None:
    response = client.post(URL, json=_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["patient_name"] == "Nguyen An"
    assert body["notes"] == "Routine follow-up"
    assert [d["code"] for d in body["diagnoses"]] == ["E11.9", "I10"]
    assert isinstance(body["id"], int)
    assert body["created_at"]


def test_create_unknown_code_returns_422_naming_the_code(client: TestClient, codes: None) -> None:
    response = client.post(URL, json=_payload(diagnosis_codes=["E11.9", "Z99.9"]))

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "Z99.9" in error["message"]
    assert "E11.9" not in error["message"]


def test_create_unknown_code_writes_nothing(client: TestClient, codes: None, db: Session) -> None:
    client.post(URL, json=_payload(diagnosis_codes=["E11.9", "Z99.9"]))

    assert db.execute(select(func.count()).select_from(Consultation)).scalar_one() == 0


def test_create_empty_diagnosis_codes_returns_422(client: TestClient, codes: None) -> None:
    response = client.post(URL, json=_payload(diagnosis_codes=[]))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_create_blank_patient_name_returns_422(client: TestClient, codes: None, name: str) -> None:
    response = client.post(URL, json=_payload(patient_name=name))

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "body.patient_name"


def test_create_strips_patient_name(client: TestClient, codes: None) -> None:
    response = client.post(URL, json=_payload(patient_name="  Tran Bao  "))

    assert response.json()["patient_name"] == "Tran Bao"


def test_create_response_diagnoses_order(client: TestClient, codes: None) -> None:
    # Submitted out of alphabetical order; the response is by code, not as submitted.
    # The service sorts on write — without it, expire_on_commit=False hands back the
    # in-memory list in submission order and POST disagrees with GET.
    response = client.post(URL, json=_payload(diagnosis_codes=["I10", "E11.9"]))

    assert [d["code"] for d in response.json()["diagnoses"]] == ["E11.9", "I10"]


def test_list_response_diagnoses_order_matches_create(client: TestClient, codes: None) -> None:
    created = client.post(URL, json=_payload(diagnosis_codes=["I10", "E11.9"]))

    listed = client.get(URL)

    assert [d["code"] for d in listed.json()[0]["diagnoses"]] == ["E11.9", "I10"]
    assert listed.json()[0]["diagnoses"] == created.json()["diagnoses"]


def test_create_returns_created_at_as_explicit_utc(client: TestClient, codes: None) -> None:
    response = client.post(URL, json=_payload())

    created_at = response.json()["created_at"]
    # The column is naive UTC, so without the schema validator this would carry no offset
    # and a client would be free to read it as local time.
    assert created_at.endswith("Z")
    assert datetime.fromisoformat(created_at).utcoffset() == timedelta(0)


def test_list_returns_created_at_as_explicit_utc(client: TestClient, db: Session) -> None:
    db.add(make_consultation("Nguyen An", created_at=datetime(2026, 9, 1, 9, 0)))
    db.commit()

    response = client.get(URL)

    # Same instant, now labelled — not shifted by the server's local zone.
    assert response.json()[0]["created_at"] == "2026-09-01T09:00:00Z"
    assert datetime.fromisoformat(response.json()[0]["created_at"]) == datetime(
        2026, 9, 1, 9, 0, tzinfo=UTC
    )


def test_list_returns_newest_first(client: TestClient, db: Session) -> None:
    db.add_all(
        [
            make_consultation("Oldest", created_at=datetime(2026, 9, 1, 9, 0)),
            make_consultation("Newest", created_at=datetime(2026, 9, 3, 9, 0)),
            make_consultation("Middle", created_at=datetime(2026, 9, 2, 9, 0)),
        ]
    )
    db.commit()

    response = client.get(URL)

    assert response.status_code == 200
    assert [row["patient_name"] for row in response.json()] == ["Newest", "Middle", "Oldest"]


def test_list_filtered_by_patient_narrows(client: TestClient, db: Session) -> None:
    db.add_all([make_consultation("Nguyen An"), make_consultation("Tran Bao")])
    db.commit()

    response = client.get(URL, params={"patient": "nguyen"})

    assert response.status_code == 200
    assert [row["patient_name"] for row in response.json()] == ["Nguyen An"]


def test_list_filtered_by_code_narrows(client: TestClient, db: Session, codes: None) -> None:
    diabetes = make_diagnosis("E11.9")
    hypertension = make_diagnosis("I10")
    db.add_all(
        [
            make_consultation("Has diabetes", diagnoses=[db.merge(diabetes)]),
            make_consultation("Has hypertension", diagnoses=[db.merge(hypertension)]),
        ]
    )
    db.commit()

    response = client.get(URL, params={"code": "E11.9"})

    assert response.status_code == 200
    body = response.json()
    assert [row["patient_name"] for row in body] == ["Has diabetes"]
    assert [d["code"] for d in body[0]["diagnoses"]] == ["E11.9"]


def test_list_code_filter_applies_before_the_limit(
    client: TestClient, db: Session, codes: None
) -> None:
    # Post-filtering a fetched page would return nothing here: the three hypertension
    # rows are newest and would fill limit=3 on their own.
    diabetes = db.merge(make_diagnosis("E11.9"))
    hypertension = db.merge(make_diagnosis("I10"))
    db.add(make_consultation("Diabetic", diagnoses=[diabetes], created_at=datetime(2026, 9, 1)))
    db.add_all(
        make_consultation(
            f"Hypertensive {i}",
            diagnoses=[hypertension],
            created_at=datetime(2026, 9, 2 + i),
        )
        for i in range(3)
    )
    db.commit()

    response = client.get(URL, params={"code": "E11.9", "limit": 3})

    assert [row["patient_name"] for row in response.json()] == ["Diabetic"]


def test_list_unknown_code_returns_empty_list(client: TestClient, db: Session) -> None:
    db.add(make_consultation("Nguyen An"))
    db.commit()

    response = client.get(URL, params={"code": "Z99.9"})

    assert response.status_code == 200
    assert response.json() == []


def test_list_respects_limit_and_offset(client: TestClient, db: Session) -> None:
    db.add_all(
        make_consultation(f"Patient {i}", created_at=datetime(2026, 9, 1 + i)) for i in range(5)
    )
    db.commit()

    response = client.get(URL, params={"limit": 2, "offset": 1})

    assert [row["patient_name"] for row in response.json()] == ["Patient 3", "Patient 2"]


def test_list_limit_above_100_returns_422(client: TestClient) -> None:
    response = client.get(URL, params={"limit": 101})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
