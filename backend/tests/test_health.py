from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exceptions import DatabaseUnavailableError
from app.db.dependencies import get_db
from app.db.session import create_db_engine, create_session_factory, safe_url
from app.main import create_app
from app.services.health import check_database
from tests.conftest import make_settings

# ---------------------------------------------------------------- startup / root


def test_application_starts_and_stops_cleanly(app: FastAPI) -> None:
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert app.state.engine is not None
        assert app.state.session_factory is not None


def test_root_endpoint(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {
        "application": "NIRF Insights API",
        "version": "1.0.0",
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/api/health",
    }


# ---------------------------------------------------------------- health / readiness


def test_health_endpoint_reports_connected_database(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "application": "NIRF Insights API",
        "database": "connected",
    }


def test_readiness_endpoint(client: TestClient) -> None:
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "application": "NIRF Insights API",
        "database": "connected",
    }


def test_health_runs_a_real_query(client: TestClient, app: FastAPI) -> None:
    """The endpoint must execute SQL rather than just claim 'connected'."""
    statements: list[str] = []
    from sqlalchemy import event

    @event.listens_for(app.state.engine, "before_cursor_execute")
    def capture(_conn, _cursor, statement, *_args) -> None:
        statements.append(statement)

    assert client.get("/api/health").status_code == 200
    assert any(s.strip().upper() == "SELECT 1" for s in statements)


def test_api_prefix_is_configurable(tmp_path) -> None:
    settings = make_settings(f"sqlite:///{(tmp_path / 'p.db').as_posix()}", api_prefix="/v2/")
    with TestClient(create_app(settings)) as client:
        assert client.get("/v2/health").status_code == 200
        assert client.get("/api/health").status_code == 404
        assert client.get("/").json()["health_url"] == "/v2/health"


# ---------------------------------------------------------------- database connectivity check


def test_check_database_succeeds_on_working_database(app: FastAPI, client: TestClient) -> None:
    with app.state.session_factory() as session:
        check_database(session)  # does not raise


def test_check_database_raises_on_unreachable_database(broken_app: FastAPI) -> None:
    engine = create_db_engine(broken_app.state.settings.database_url)
    try:
        with create_session_factory(engine)() as session, pytest.raises(DatabaseUnavailableError):
            check_database(session)
    finally:
        engine.dispose()


# ---------------------------------------------------------------- unavailable database


@pytest.mark.parametrize("path", ["/api/health", "/api/health/ready"])
def test_unavailable_database_returns_503_with_standard_error(broken_app: FastAPI, path: str) -> None:
    with TestClient(broken_app) as client:  # startup must survive an unreachable database
        response = client.get(path)
    assert response.status_code == 503
    assert response.json() == {
        "success": False,
        "error": {
            "code": "DATABASE_UNAVAILABLE",
            "message": "Database connection could not be established",
        },
    }


def test_database_errors_do_not_leak_paths_or_credentials(broken_app: FastAPI) -> None:
    with TestClient(broken_app) as client:
        body = client.get("/api/health").text
    assert "no_such_dir" not in body
    assert "sqlite" not in body.lower()
    assert "Traceback" not in body


def test_root_still_works_when_database_is_down(broken_app: FastAPI) -> None:
    with TestClient(broken_app) as client:
        assert client.get("/").status_code == 200


# ---------------------------------------------------------------- error handling structure


def test_unknown_route_uses_standard_error_shape(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"
    assert isinstance(body["error"]["message"], str)


def test_method_not_allowed_uses_standard_error_shape(client: TestClient) -> None:
    response = client.post("/api/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_validation_errors_use_standard_shape_without_echoing_input(tmp_path) -> None:
    app = create_app(make_settings(f"sqlite:///{(tmp_path / 'v.db').as_posix()}"))

    @app.get("/_test/number")
    def number(value: int) -> dict:
        return {"value": value}

    with TestClient(app) as client:
        response = client.get("/_test/number", params={"value": "secret-text"})
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "query.value"
    assert "secret-text" not in response.text


def _app_with_failing_route(tmp_path, *, debug: bool) -> FastAPI:
    app = create_app(
        make_settings(f"sqlite:///{(tmp_path / 'e.db').as_posix()}", debug=debug)
    )

    @app.get("/_test/boom")
    def boom() -> None:
        raise RuntimeError("internal secret detail")

    return app


def test_unexpected_errors_are_hidden_in_production(tmp_path) -> None:
    app = _app_with_failing_route(tmp_path, debug=False)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/_test/boom")
    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred"},
    }
    assert "internal secret detail" not in response.text
    assert "Traceback" not in response.text


def test_unexpected_errors_are_logged_with_detail(tmp_path, caplog) -> None:
    app = _app_with_failing_route(tmp_path, debug=False)
    with caplog.at_level("ERROR"), TestClient(app, raise_server_exceptions=False) as client:
        client.get("/_test/boom")
    assert "internal secret detail" in caplog.text  # detail is kept in server logs


def test_debug_mode_includes_error_detail(tmp_path) -> None:
    app = _app_with_failing_route(tmp_path, debug=True)
    with TestClient(app, raise_server_exceptions=False) as client:
        body = client.get("/_test/boom").json()
    assert body["error"]["details"]["type"] == "RuntimeError"


# ---------------------------------------------------------------- session dependency, config, docs


def test_get_db_rolls_back_on_error_and_always_closes() -> None:
    session = MagicMock(spec=Session)
    request = MagicMock()
    request.app.state.session_factory.return_value = session

    gen = get_db(request)
    assert next(gen) is session
    with pytest.raises(ValueError):
        gen.throw(ValueError("route failed"))
    session.rollback.assert_called_once()
    session.close.assert_called_once()


def test_get_db_closes_session_on_success() -> None:
    session = MagicMock(spec=Session)
    request = MagicMock()
    request.app.state.session_factory.return_value = session

    gen = get_db(request)
    next(gen)
    with pytest.raises(StopIteration):
        next(gen)
    session.close.assert_called_once()
    session.rollback.assert_not_called()


def test_dependency_override_supports_a_separate_database(app: FastAPI, tmp_path) -> None:
    engine = create_db_engine(f"sqlite:///{(tmp_path / 'other.db').as_posix()}")
    factory = create_session_factory(engine)

    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        assert client.get("/api/health").json()["database"] == "connected"
    engine.dispose()


def test_cors_allows_configured_origin_only(tmp_path) -> None:
    settings = make_settings(
        f"sqlite:///{(tmp_path / 'c.db').as_posix()}", cors_origins="http://localhost:5173"
    )
    with TestClient(create_app(settings)) as client:
        allowed = client.get("/", headers={"Origin": "http://localhost:5173"})
        denied = client.get("/", headers={"Origin": "http://evil.example"})
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers


def test_cors_origins_parse_from_comma_separated_string() -> None:
    settings = make_settings("sqlite://", cors_origins="http://a.test, http://b.test")
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_database_url_password_is_masked_for_logging() -> None:
    masked = safe_url("postgresql+psycopg://user:hunter2@localhost:5432/nirf")
    assert "hunter2" not in masked
    assert "***" in masked


def test_openapi_and_swagger_docs_available(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "NIRF Insights API"
    assert schema["info"]["version"] == "1.0.0"
    assert {"/", "/api/health", "/api/health/ready"} <= set(schema["paths"])
