"""Loads the cleaned NIRF dataset once and exposes small query helpers."""
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).parent / "data" / "nirf_clean.csv"

PARAMS = ["TLR", "RPC", "GO", "OI", "PERCEPTION"]
# Columns the API / the AI analyst may expose or filter on (whitelist).
FIELDS = [
    "year", "category", "rank", "rank_base", "rank_suffix", "rank_type",
    "institution_id", "institution_name", "city", "state", "score",
    *PARAMS, "has_score",
]


def _load() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig", keep_default_na=True)
    df["rank"] = pd.to_numeric(df["rank"], errors="coerce")
    df["rank_base"] = pd.to_numeric(df["rank_base"], errors="coerce")
    df["rank_suffix"] = df["rank_suffix"].fillna("")
    return df


DF = _load()


def to_records(frame: pd.DataFrame, cols=None):
    """DataFrame -> JSON-safe list of dicts (NaN -> None, numpy -> python)."""
    cols = [c for c in (cols or FIELDS) if c in frame.columns]
    out = frame[cols].astype(object).where(frame[cols].notna(), None)
    recs = out.to_dict(orient="records")
    for r in recs:
        for k, v in r.items():
            if hasattr(v, "item"):
                r[k] = v.item()
            if isinstance(r[k], float) and r[k].is_integer() and k in ("rank", "rank_base", "year"):
                r[k] = int(r[k])
    return recs


def meta():
    inst = (
        DF.sort_values("year")
        .groupby("institution_id")
        .agg(name=("institution_name", "last"), state=("state", "last"),
             first_year=("year", "min"), last_year=("year", "max"))
        .reset_index()
        .sort_values("name")
    )
    cat_years = DF.groupby("category")["year"].agg(["min", "max"])
    return {
        "years": sorted(DF["year"].unique().tolist()),
        "categories": [
            {"name": c, "min_year": int(r["min"]), "max_year": int(r["max"])}
            for c, r in cat_years.iterrows()
        ],
        "states": sorted(DF["state"].dropna().unique().tolist()),
        "institutions": [
            {"id": r.institution_id, "name": r.name, "state": r.state,
             "first_year": int(r.first_year), "last_year": int(r.last_year)}
            for r in inst.itertuples()
        ],
    }
