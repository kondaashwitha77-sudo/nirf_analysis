"""Engine and session-factory construction.

There is deliberately no module-level engine or session. The application builds both in its
lifespan and stores them on ``app.state``; routes receive sessions via ``get_db``.
"""

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def create_db_engine(database_url: str, *, echo: bool = False) -> Engine:
    url = make_url(database_url)
    options: dict = {"echo": echo}

    if url.get_backend_name() == "sqlite":
        # FastAPI serves requests from a thread pool, so SQLite connections must be shareable.
        options["connect_args"] = {"check_same_thread": False}
        if url.database in (None, "", ":memory:"):
            # An in-memory database exists per connection; share a single one.
            options["poolclass"] = StaticPool
    else:
        # PostgreSQL and others: detect stale connections before use.
        options["pool_pre_ping"] = True

    engine = create_engine(url, **options)

    if url.get_backend_name() == "sqlite":

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record) -> None:  # pragma: no cover - trivial
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def safe_url(database_url: str) -> str:
    """The database URL with any password masked, safe for logs."""
    return make_url(database_url).render_as_string(hide_password=True)
