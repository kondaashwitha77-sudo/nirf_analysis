"""NIRF Insights API.  Run:  uvicorn main:app --reload --port 8000"""
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import nl_query  # noqa: E402  (after load_dotenv so env vars are visible)
from data_store import DF, PARAMS, meta, to_records  # noqa: E402

app = FastAPI(title="NIRF Insights API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_META = meta()


@app.get("/api/health")
def health():
    return {"ok": True, "rows": len(DF)}


@app.get("/api/meta")
def get_meta():
    return _META


@app.get("/api/rankings")
def rankings(
    year: int,
    category: str = "Overall",
    state: Optional[str] = None,
    min_rank: int = 1,
    max_rank: int = 100,
    limit: int = 200,
):
    d = DF[(DF.year == year) & (DF.category == category)]
    if state:
        d = d[d.state == state]
    d = d[(d.rank_base >= min_rank) & (d.rank_base <= max_rank)]
    d = d.sort_values(["rank_base", "rank_suffix", "institution_name"]).head(limit)
    return to_records(d)


@app.get("/api/institution/{institution_id}")
def institution(institution_id: str):
    d = DF[DF.institution_id == institution_id].sort_values(["year", "category"])
    if d.empty:
        raise HTTPException(404, "Unknown institution")
    return to_records(d)


@app.get("/api/trend")
def trend(ids: str, category: str = "Overall"):
    """Rank/score per year for one or more institutions (comma-separated ids)."""
    id_list = [i for i in ids.split(",") if i]
    d = DF[DF.institution_id.isin(id_list) & (DF.category == category)].sort_values("year")
    return to_records(d)


@app.get("/api/compare")
def compare(ids: str, year: int, category: str = "Overall"):
    id_list = [i for i in ids.split(",") if i]
    d = DF[DF.institution_id.isin(id_list) & (DF.year == year) & (DF.category == category)]
    return to_records(d)


@app.get("/api/states")
def states(year: int, category: str = "Overall", top: int = Query(100, ge=1, le=500)):
    """How many institutions per state inside the top-N, plus average score."""
    d = DF[(DF.year == year) & (DF.category == category) & (DF.rank_base <= top)]
    g = (
        d.groupby("state")
        .agg(count=("institution_id", "nunique"), avg_score=("score", "mean"))
        .reset_index()
        .sort_values("count", ascending=False)
    )
    g["avg_score"] = g["avg_score"].round(2)
    return g.astype(object).where(g.notna(), None).to_dict(orient="records")


@app.get("/api/parameters")
def parameters(year: int, category: str = "Overall", top: int = 100):
    """Average of each parameter for the top-N institutions, per year."""
    d = DF[(DF.category == category) & (DF.rank_base <= top)]
    g = d.groupby("year")[PARAMS].mean().round(2).reset_index()
    return g.astype(object).where(g.notna(), None).to_dict(orient="records")


class Turn(BaseModel):
    role: str
    content: str


class QueryIn(BaseModel):
    question: str
    history: list[Turn] = []


@app.post("/api/query")
def query(body: QueryIn):
    try:
        return nl_query.answer(body.question, [t.model_dump() for t in body.history])
    except nl_query.PlanError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # malformed plan, network, etc.
        raise HTTPException(500, f"Could not answer: {e}")
