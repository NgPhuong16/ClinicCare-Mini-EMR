import pytest

from app.core.exceptions import ValidationError
from app.services.diagnosis import normalize_search_term


def test_normalize_search_term_strips_and_lowercases() -> None:
    assert normalize_search_term("  Diab  ") == "diab"


@pytest.mark.parametrize("term", ["", " ", "\t \n"])
def test_normalize_search_term_blank_raises_validation_error(term: str) -> None:
    with pytest.raises(ValidationError, match="must not be empty"):
        normalize_search_term(term)
