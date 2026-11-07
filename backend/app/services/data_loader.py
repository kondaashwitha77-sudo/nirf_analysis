"""Load the cleaned NIRF CSV into the `rankings` table."""

import csv
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models import Ranking

logger = get_logger(__name__)

_INT = {"year", "rank", "tlr_rank", "rpc_rank", "go_rank", "oi_rank", "perception_rank"}
_FLOAT = {
    "overall_score", "tlr_score", "rpc_score", "go_score", "qnr_score", "qlr_score",
    "sfc_score", "oi_score", "perception_score",
}
_TEXT = {
    "category", "canonical_institution_id", "canonical_institution_name", "standardised_institution_name",
    "institution_type", "institution_match_method", "institute_id", "institution_name", "city", "state",
    "geographic_zone", "rank_raw", "source_url", "source_page", "source_page_type",
}
_REQUIRED = {"year", "category", "canonical_institution_id", "standardised_institution_name", "institution_type"}


class DataLoadError(Exception):
    pass


def _clean(row: dict[str, str]) -> dict:
    """Convert CSV text to typed values. Blank means missing (None), never 0."""
    out: dict = {}
    for key in _INT | _FLOAT | _TEXT:
        raw = (row.get(key) or "").strip()
        if raw == "":
            out[key] = None
        elif key in _INT:
            out[key] = int(float(raw))
        elif key in _FLOAT:
            out[key] = float(raw)
        else:
            out[key] = raw
    missing = [k for k in _REQUIRED if out.get(k) is None]
    if missing:
        raise DataLoadError(f"Row is missing required values: {', '.join(sorted(missing))}")
    return out


def load_rankings(session: Session, csv_path: Path, *, replace: bool = True) -> int:
    """Insert every CSV row. With ``replace`` the table is emptied first, so re-running is safe."""
    csv_path = Path(csv_path)
    if not csv_path.is_file():
        raise DataLoadError(f"CSV not found: {csv_path}")

    with csv_path.open(encoding="utf-8-sig", newline="") as fh:
        rows = [_clean(r) for r in csv.DictReader(fh)]
    if not rows:
        raise DataLoadError("CSV has no data rows")

    if replace:
        session.execute(delete(Ranking))
    session.bulk_insert_mappings(Ranking, rows)
    session.commit()
    logger.info("Loaded %d ranking rows from %s", len(rows), csv_path.name)
    return len(rows)
