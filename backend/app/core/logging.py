"""Centralised logging setup."""

import logging

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_HANDLER_MARK = "_nirf_insights_handler"


def setup_logging(level: str = "INFO") -> None:
    """Configure the root logger once. Safe to call repeatedly (e.g. per test app)."""
    root = logging.getLogger()
    root.setLevel(level)

    handler = next((h for h in root.handlers if getattr(h, _HANDLER_MARK, False)), None)
    if handler is None:
        handler = logging.StreamHandler()
        setattr(handler, _HANDLER_MARK, True)
        root.addHandler(handler)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.setLevel(level)

    # The app logs one line per request itself; silence uvicorn's duplicate access log.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # Keep SQL statements out of the logs unless explicitly debugging the database.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
