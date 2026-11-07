from pydantic import BaseModel, ConfigDict


class RankingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    year: int
    category: str
    canonical_institution_id: str
    institution: str  # standardised name
    institution_type: str
    city: str | None
    state: str | None
    zone: str | None
    rank: int | None
    overall_score: float | None
    tlr_score: float | None
    rpc_score: float | None
    go_score: float | None
    oi_score: float | None
    perception_score: float | None


class RankingPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[RankingOut]


class MetaResponse(BaseModel):
    years: list[int]
    categories: list[str]
    zones: list[str]
    states: list[str]
    institution_types: list[str]
    records: int
    institutions: int
