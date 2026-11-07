from pydantic import BaseModel, Field


class NarrateRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    summary: str = Field(max_length=2000)
    filters: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    columns: list[str] = Field(default_factory=list, max_length=20)
    rows: list[dict[str, str | float | int | None]] = Field(default_factory=list, max_length=25)


class NarrateResponse(BaseModel):
    answer: str
