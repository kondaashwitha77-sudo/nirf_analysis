from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.exceptions import DatabaseUnavailableError
from app.core.logging import get_logger

logger = get_logger(__name__)


def check_database(db: Session) -> None:
    """Run a lightweight query. Raises DatabaseUnavailableError if it fails."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Detail stays in the server log; the client only sees the generic message.
        logger.error("Database connectivity check failed: %s", exc.__class__.__name__, exc_info=exc)
        raise DatabaseUnavailableError() from exc
