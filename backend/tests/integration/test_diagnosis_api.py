import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import make_diagnosis

URL = "/api/v1/diagnoses"


@pytest.fixture
def seeded(db: Session) -> None:
    db.add_all(
        [
            make_diagnosis("E11.9", "Type 2 diabetes mellitus without complications"),
            make_diagnosis("E11.65", "Type 2 diabetes mellitus with hyperglycemia"),
            make_diagnosis("I10", "Essential (primary) hypertension"),
            make_diagnosis("J45.20", "Mild intermittent asthma, uncomplicated"),
            make_diagnosis("Z00.00", "Encounter for general adult medical examination"),
        ]
    )
    db.commit()


def test_search_matches_by_code(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "e11"})

    assert response.status_code == 200
    assert [row["code"] for row in response.json()] == ["E11.65", "E11.9"]


def test_search_matches_by_description(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "HYPERTENSION"})

    assert response.status_code == 200
    assert response.json() == [{"code": "I10", "description": "Essential (primary) hypertension"}]


def test_search_strips_surrounding_whitespace(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "  asthma  "})

    assert response.status_code == 200
    assert [row["code"] for row in response.json()] == ["J45.20"]


@pytest.mark.parametrize("term", ["", "   ", "\t\n"])
def test_search_blank_term_returns_422_envelope(
    client: TestClient, seeded: None, term: str
) -> None:
    response = client.get(URL, params={"search": term})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_missing_term_returns_422_envelope(client: TestClient, seeded: None) -> None:
    response = client.get(URL)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_respects_limit(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "diabetes", "limit": 1})

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_search_limit_defaults_to_20(client: TestClient, db: Session) -> None:
    db.add_all(make_diagnosis(f"Q{i:02d}.0", f"Test condition {i}") for i in range(25))
    db.commit()

    response = client.get(URL, params={"search": "test condition"})

    assert response.status_code == 200
    assert len(response.json()) == 20


def test_search_limit_above_100_returns_422_envelope(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "diabetes", "limit": 101})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_no_match_returns_empty_list(client: TestClient, seeded: None) -> None:
    response = client.get(URL, params={"search": "zzz-nothing"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_treats_like_wildcards_literally(client: TestClient, seeded: None) -> None:
    # "%" would otherwise match every row.
    response = client.get(URL, params={"search": "%"})

    assert response.status_code == 200
    assert response.json() == []


def test_search_succeeds_without_an_auth_cookie(client: TestClient, seeded: None) -> None:
    # Diagnoses are reference data, not a patient record — unlike consultations, the
    # router carries no get_current_doctor dependency.
    response = client.get(URL, params={"search": "diab"})

    assert response.status_code == 200
