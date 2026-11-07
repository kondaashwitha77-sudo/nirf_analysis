"""Domain exceptions and the handlers that turn every failure into the standard error body."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger
from app.schemas.common import ErrorBody, ErrorResponse

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for expected, client-presentable errors."""

    status_code = 500
    code = "INTERNAL_SERVER_ERROR"
    message = "An unexpected error occurred"

    def __init__(self, message: str | None = None, *, details: Any | None = None) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class DatabaseUnavailableError(AppError):
    status_code = 503
    code = "DATABASE_UNAVAILABLE"
    message = "Database connection could not be established"


class AINotConfiguredError(AppError):
    status_code = 503
    code = "AI_NOT_CONFIGURED"
    message = "The AI service is not configured on the server"


class AIUpstreamError(AppError):
    status_code = 502
    code = "AI_UPSTREAM_ERROR"
    message = "The AI service could not answer right now"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Resource not found"


def error_response(
    status_code: int, code: str, message: str, details: Any | None = None
) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details))
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


_HTTP_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
}


def register_exception_handlers(app: FastAPI, *, debug: bool) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        logger.warning("%s on %s %s: %s", exc.code, request.method, request.url.path, exc.message)
        return error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Only field location and message are returned: never the submitted values.
        details = [
            {"field": ".".join(str(part) for part in err["loc"]), "message": err["msg"]}
            for err in exc.errors()
        ]
        logger.info("Validation error on %s %s: %d issue(s)", request.method, request.url.path, len(details))
        return error_response(422, "VALIDATION_ERROR", "Request validation failed", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
        message = exc.detail if isinstance(exc.detail, str) else "Request could not be processed"
        response = error_response(exc.status_code, code, message)
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(SQLAlchemyError)
    async def handle_database_error(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        # Full detail (which may include connection info) goes to the log only.
        logger.error("Database error on %s %s", request.method, request.url.path, exc_info=exc)
        if isinstance(exc, OperationalError):
            err = DatabaseUnavailableError()
            return error_response(err.status_code, err.code, err.message)
        return error_response(500, "DATABASE_ERROR", "A database error occurred")

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc
        )
        details = {"type": type(exc).__name__, "message": str(exc)} if debug else None
        return error_response(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred", details)
