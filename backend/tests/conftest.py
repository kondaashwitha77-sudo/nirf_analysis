"""Test fixtures. Every test gets its own temporary SQLite database; nothing real is touched."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def make_settings(database_url: str, **overrides) -> Settings:
    # _env_file=None: never read the developer's real .env during tests.
    return Settings(
        _env_file=None,
        environment="testing",
        database_url=database_url,
        **overrides,
    )


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    # Entering the context manager runs the startup/shutdown lifespan.
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def broken_app(tmp_path: Path) -> FastAPI:
    """An app whose database cannot be opened (its directory does not exist)."""
    missing = tmp_path / "no_such_dir" / "db.sqlite"
    return create_app(make_settings(f"sqlite:///{missing.as_posix()}"))
