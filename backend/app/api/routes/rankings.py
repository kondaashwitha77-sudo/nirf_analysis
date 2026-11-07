from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.db.dependencies import get_db
from app.schemas.ranking import MetaResponse, RankingOut, RankingPage
from app.services import rankings as svc

router = APIRouter(tags=["Rankings"])
Db = Annotated[Session, Depends(get_db)]


@router.get("/meta", response_model=MetaResponse, summary="Filter options and dataset size")
def meta(db: Db) -> MetaResponse:
    return svc.get_meta(db)


@router.get("/rankings", response_model=RankingPage, summary="Ranking records with optional filters")
def rankings(
    db: Db,
    year: int | None = None,
    category: str | None = None,
    state: str | None = None,
    zone: str | None = None,
    institution_type: str | None = None,
    q: Annotated[str | None, Query(max_length=100, description="Search institution name or city")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RankingPage:
    return svc.list_rankings(
        db, year=year, category=category, state=state, zone=zone,
        institution_type=institution_type, q=q, limit=limit, offset=offset,
    )


@router.get("/rankings/all", response_model=list[RankingOut], summary="All ranking records (dashboard start-up load)")
def rankings_all(db: Db) -> list[RankingOut]:
    return svc.all_rankings(db)


@router.get("/institutions/{canonical_id}", response_model=list[RankingOut], summary="One institution across years")
def institution(canonical_id: str, db: Db) -> list[RankingOut]:
    rows = svc.institution_history(db, canonical_id)
    if not rows:
        raise NotFoundError("No institution with that id")
    return rows
