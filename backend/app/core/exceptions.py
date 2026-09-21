class DomainError(Exception):
    """Base for errors raised by services. `code` is what the frontend switches on."""

    code: str = "DOMAIN_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(DomainError):
    code = "NOT_FOUND"


class ValidationError(DomainError):
    code = "VALIDATION_ERROR"


class ConflictError(DomainError):
    code = "CONFLICT"
