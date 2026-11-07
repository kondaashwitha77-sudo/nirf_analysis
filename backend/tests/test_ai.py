import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services import ai as ai_service
from tests.conftest import make_settings

BODY = {
    "question": "Which institutions lead in 2025?",
    "summary": "IIT Madras is ranked 1.",
    "filters": [{"label": "Year", "value": "2025"}],
    "columns": ["institution", "rank"],
    "rows": [{"institution": "IIT Madras", "rank": 1}],
}


def _client(tmp_path, **kw):
    app = create_app(make_settings(f"sqlite:///{(tmp_path / 'a.db').as_posix()}", **kw))
    return TestClient(app)


def test_not_configured_returns_503(tmp_path):
    with _client(tmp_path) as c:
        r = c.post("/api/ai/narrate", json=BODY)
    assert r.status_code == 503 and r.json()["error"]["code"] == "AI_NOT_CONFIGURED"


def test_success_uses_key_server_side_and_never_returns_it(tmp_path, monkeypatch):
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, auth=headers["Authorization"], model=json["model"], prompt=json["messages"][1]["content"])
        return httpx.Response(200, json={"choices": [{"message": {"content": " IIT Madras leads. "}}]},
                              request=httpx.Request("POST", url))

    monkeypatch.setattr(ai_service.httpx, "post", fake_post)
    with _client(tmp_path, ai_api_key="sk-secret-123", ai_model="m1") as c:
        r = c.post("/api/ai/narrate", json=BODY)
    assert r.status_code == 200 and r.json() == {"answer": "IIT Madras leads."}
    assert seen["auth"] == "Bearer sk-secret-123" and seen["model"] == "m1"
    assert "IIT Madras" in seen["prompt"] and "sk-secret" not in r.text


def test_upstream_failure_is_502_without_leaking(tmp_path, monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("secret-host")

    monkeypatch.setattr(ai_service.httpx, "post", boom)
    with _client(tmp_path, ai_api_key="sk-secret-123") as c:
        r = c.post("/api/ai/narrate", json=BODY)
    assert r.status_code == 502 and r.json()["error"]["code"] == "AI_UPSTREAM_ERROR"
    assert "secret" not in r.text


@pytest.mark.parametrize("bad", [{**BODY, "question": "x"}, {**BODY, "rows": [{"a": 1}] * 26}])
def test_validation(tmp_path, bad):
    with _client(tmp_path, ai_api_key="k") as c:
        assert c.post("/api/ai/narrate", json=bad).status_code == 422
