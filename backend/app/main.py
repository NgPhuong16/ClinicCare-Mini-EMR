import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.health import router as health_router
from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.core.exceptions import ConflictError, DomainError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)

_DOMAIN_STATUS: dict[type[DomainError], int] = {
    NotFoundError: 404,
    ValidationError: 422,
    ConflictError: 409,
}

_HTTP_STATUS_CODES: dict[int, str] = {
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
}


def _envelope(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, str]] | None = None,
) -> JSONResponse:
    error: dict[str, object] = {"code": code, "message": message}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error})


def _status_for(exc: DomainError) -> int:
    # Walk the MRO, most specific first, so a subclass such as
    # DiagnosisNotFoundError(NotFoundError) inherits 404 instead of falling through to 400.
    for klass in type(exc).__mro__:
        status = _DOMAIN_STATUS.get(klass)
        if status is not None:
            return status
    return 400


async def _domain_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, DomainError)
    return _envelope(_status_for(exc), exc.code, exc.message)


async def _request_validation_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [
        {"field": ".".join(str(part) for part in err["loc"]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return _envelope(422, "VALIDATION_ERROR", "Request validation failed", details)


async def _http_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_STATUS_CODES.get(exc.status_code, "HTTP_ERROR")
    return _envelope(exc.status_code, code, exc.detail)


async def _unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return _envelope(500, "INTERNAL_ERROR", "An unexpected error occurred")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, _domain_error_handler)
    app.add_exception_handler(RequestValidationError, _request_validation_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.debug)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
