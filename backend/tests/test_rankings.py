import csv
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.main import create_app
from app.services.data_loader import DataLoadError, load_rankings
from tests.conftest import make_settings

COLUMNS = [
    "year", "category", "institute_id", "institution_name", "city", "state", "rank", "rank_raw",
    "overall_score", "tlr_score", "tlr_rank", "rpc_score", "rpc_rank", "go_score", "go_rank",
    "qnr_score", "qlr_score", "sfc_score", "oi_score", "oi_rank", "perception_score", "perception_rank",
    "source_url", "source_page", "source_page_type", "geographic_zone", "canonical_institution_id",
    "canonical_institution_name", "standardised_institution_name", "institution_type",
    "institution_match_method",
]


def _row(**kw):
    base = {c: "" for c in COLUMNS}
    base.update(category="Overall", institution_type="IIT", institution_match_method="id_code", source_page_type="main")
    base.update(kw)
    return base


ROWS = [
    _row(year="2024", institute_id="IR-O-U-0456", institution_name="Indian Institute of Technology Madras",
         city="Chennai", state="Tamil Nadu", rank="1", rank_raw="1", overall_score="90.5", geographic_zone="Southern Zone",
         canonical_institution_id="U-0456", canonical_institution_name="Indian Institute of Technology Madras",
         standardised_institution_name="Indian Institute of Technology Madras"),
    _row(year="2025", institute_id="IR-O-U-0456", institution_name="Indian Institute of Technology Madras",
         city="Chennai", state="Tamil Nadu", rank="2", rank_raw="2", overall_score="89.0", geographic_zone="Southern Zone",
         canonical_institution_id="U-0456", canonical_institution_name="Indian Institute of Technology Madras",
         standardised_institution_name="Indian Institute of Technology Madras"),
    _row(year="2025", institution_name="Delhi College", city="Delhi", state="Delhi", rank="", rank_raw="",
         overall_score="", geographic_zone="Northern Zone", institution_type="College", category="College",
         canonical_institution_id="C-1", canonical_institution_name="Delhi College",
         standardised_institution_name="Delhi College"),
]


def _write_csv(path: Path, rows) -> Path:
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    return path


@pytest.fixture
def seeded(tmp_path):
    app = create_app(make_settings(f"sqlite:///{(tmp_path / 'r.db').as_posix()}"))
    with TestClient(app) as client:
        Base.metadata.create_all(app.state.engine)
        with app.state.session_factory() as session:
            load_rankings(session, _write_csv(tmp_path / "d.csv", ROWS))
        yield client, app, tmp_path


def test_loader_counts_and_blank_means_none(seeded):
    client, *_ = seeded
    body = client.get("/api/rankings", params={"category": "College"}).json()
    assert body["total"] == 1
    assert body["items"][0]["rank"] is None and body["items"][0]["overall_score"] is None


def test_reload_replaces_instead_of_duplicating(seeded):
    client, app, tmp = seeded
    with app.state.session_factory() as session:
        assert load_rankings(session, tmp / "d.csv") == 3
    assert client.get("/api/meta").json()["records"] == 3


def test_meta(seeded):
    client, *_ = seeded
    m = client.get("/api/meta").json()
    assert m["years"] == [2024, 2025]
    assert m["categories"] == ["College", "Overall"]
    assert m["records"] == 3 and m["institutions"] == 2


def test_filters_search_and_ordering(seeded):
    client, *_ = seeded
    r = client.get("/api/rankings", params={"year": 2025}).json()
    assert [i["rank"] for i in r["items"]] == [2, None]  # unranked last
    assert client.get("/api/rankings", params={"zone": "Northern Zone"}).json()["total"] == 1
    assert client.get("/api/rankings", params={"q": "madras"}).json()["total"] == 2
    assert client.get("/api/rankings", params={"limit": 1}).json()["items"].__len__() == 1


def test_institution_history_and_not_found(seeded):
    client, *_ = seeded
    h = client.get("/api/institutions/U-0456").json()
    assert [x["year"] for x in h] == [2024, 2025]
    r = client.get("/api/institutions/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"


def test_invalid_limit_rejected(seeded):
    client, *_ = seeded
    assert client.get("/api/rankings", params={"limit": 9999}).status_code == 422


def test_loader_errors(tmp_path):
    app = create_app(make_settings(f"sqlite:///{(tmp_path / 'e.db').as_posix()}"))
    with TestClient(app):
        Base.metadata.create_all(app.state.engine)
        with app.state.session_factory() as s:
            with pytest.raises(DataLoadError):
                load_rankings(s, tmp_path / "missing.csv")
            bad = _write_csv(tmp_path / "b.csv", [_row(year="2024")])  # no canonical id
            with pytest.raises(DataLoadError):
                load_rankings(s, bad)


def test_all_rankings_returns_every_row(seeded):
    client, *_ = seeded
    rows = client.get("/api/rankings/all").json()
    assert len(rows) == 3
    assert rows[0]["year"] == 2024
