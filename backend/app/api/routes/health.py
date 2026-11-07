from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.schemas import ErrorResponse, HealthResponse, ReadinessResponse
from app.services.health import check_database

router = APIRouter(prefix="/health", tags=["Health"])

DbSession = Annotated[Session, Depends(get_db)]
_UNAVAILABLE = {503: {"model": ErrorResponse, "description": "Database unavailable"}}


@router.get("", response_model=HealthResponse, responses=_UNAVAILABLE, summary="Health check")
def health(request: Request, db: DbSession) -> HealthResponse:
    """Reports healthy only if a real query against the database succeeds."""
    check_database(db)
    return HealthResponse(
        status="healthy", application=request.app.title, database="connected"
    )


@router.get(
    "/ready", response_model=ReadinessResponse, responses=_UNAVAILABLE, summary="Readiness check"
)
def ready(request: Request, db: DbSession) -> ReadinessResponse:
    """Ready to serve requests: the application is up and the database answers queries."""
    check_database(db)
    return ReadinessResponse(status="ready", application=request.app.title, database="connected")
