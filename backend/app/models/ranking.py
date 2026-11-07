from sqlalchemy import Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Ranking(Base):
    """One row per institution, category and year, exactly as in the cleaned NIRF CSV."""

    __tablename__ = "rankings"
    __table_args__ = (
        UniqueConstraint("year", "category", "canonical_institution_id", name="uq_rankings_year_category_inst"),
        Index("ix_rankings_year_category", "year", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    category: Mapped[str] = mapped_column(String(64), index=True)

    canonical_institution_id: Mapped[str] = mapped_column(String(16), index=True)
    canonical_institution_name: Mapped[str] = mapped_column(String(300))
    standardised_institution_name: Mapped[str] = mapped_column(String(300), index=True)
    institution_type: Mapped[str] = mapped_column(String(16), index=True)
    institution_match_method: Mapped[str] = mapped_column(String(24))

    institute_id: Mapped[str | None] = mapped_column(String(32))
    institution_name: Mapped[str] = mapped_column(String(300))  # as published that year
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(64), index=True)
    geographic_zone: Mapped[str | None] = mapped_column(String(32), index=True)

    rank: Mapped[int | None] = mapped_column(Integer)
    rank_raw: Mapped[str | None] = mapped_column(String(32))
    overall_score: Mapped[float | None] = mapped_column(Float)
    tlr_score: Mapped[float | None] = mapped_column(Float)
    tlr_rank: Mapped[int | None] = mapped_column(Integer)
    rpc_score: Mapped[float | None] = mapped_column(Float)
    rpc_rank: Mapped[int | None] = mapped_column(Integer)
    go_score: Mapped[float | None] = mapped_column(Float)
    go_rank: Mapped[int | None] = mapped_column(Integer)
    qnr_score: Mapped[float | None] = mapped_column(Float)
    qlr_score: Mapped[float | None] = mapped_column(Float)
    sfc_score: Mapped[float | None] = mapped_column(Float)
    oi_score: Mapped[float | None] = mapped_column(Float)
    oi_rank: Mapped[int | None] = mapped_column(Integer)
    perception_score: Mapped[float | None] = mapped_column(Float)
    perception_rank: Mapped[int | None] = mapped_column(Integer)

    source_url: Mapped[str | None] = mapped_column(Text)
    source_page: Mapped[str | None] = mapped_column(String(32))
    source_page_type: Mapped[str | None] = mapped_column(String(32))
