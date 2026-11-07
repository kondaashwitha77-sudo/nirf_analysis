from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Ranking
from app.schemas.ranking import MetaResponse, RankingOut, RankingPage


def to_out(r: Ranking) -> RankingOut:
    return RankingOut(
        year=r.year, category=r.category, canonical_institution_id=r.canonical_institution_id,
        institution=r.standardised_institution_name, institution_type=r.institution_type,
        city=r.city, state=r.state, zone=r.geographic_zone, rank=r.rank,
        overall_score=r.overall_score, tlr_score=r.tlr_score, rpc_score=r.rpc_score,
        go_score=r.go_score, oi_score=r.oi_score, perception_score=r.perception_score,
    )


def _distinct(db: Session, col) -> list:
    return [v for (v,) in db.execute(select(col).where(col.is_not(None)).distinct().order_by(col)).all()]


def get_meta(db: Session) -> MetaResponse:
    return MetaResponse(
        years=_distinct(db, Ranking.year),
        categories=_distinct(db, Ranking.category),
        zones=_distinct(db, Ranking.geographic_zone),
        states=_distinct(db, Ranking.state),
        institution_types=_distinct(db, Ranking.institution_type),
        records=db.scalar(select(func.count(Ranking.id))) or 0,
        institutions=db.scalar(select(func.count(func.distinct(Ranking.canonical_institution_id)))) or 0,
    )


def list_rankings(
    db: Session, *, year: int | None, category: str | None, state: str | None, zone: str | None,
    institution_type: str | None, q: str | None, limit: int, offset: int,
) -> RankingPage:
    stmt = select(Ranking)
    filters = {
        Ranking.year: year, Ranking.category: category, Ranking.state: state,
        Ranking.geographic_zone: zone, Ranking.institution_type: institution_type,
    }
    for col, val in filters.items():
        if val is not None:
            stmt = stmt.where(col == val)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Ranking.standardised_institution_name.ilike(like), Ranking.city.ilike(like)))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    # rank ascending, unranked rows last
    stmt = stmt.order_by(Ranking.rank.is_(None), Ranking.rank, Ranking.standardised_institution_name)
    rows = db.scalars(stmt.limit(limit).offset(offset)).all()
    return RankingPage(total=total, limit=limit, offset=offset, items=[to_out(r) for r in rows])


def institution_history(db: Session, canonical_id: str) -> list[RankingOut]:
    rows = db.scalars(
        select(Ranking).where(Ranking.canonical_institution_id == canonical_id)
        .order_by(Ranking.year, Ranking.category)
    ).all()
    return [to_out(r) for r in rows]


def all_rankings(db: Session) -> list[RankingOut]:
    """Every row, for the dashboard's one-time start-up load (about 7k rows)."""
    rows = db.scalars(
        select(Ranking).order_by(Ranking.year, Ranking.category, Ranking.rank.is_(None), Ranking.rank)
    ).all()
    return [to_out(r) for r in rows]
