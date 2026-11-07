"""ORM models. Import each model module here so Alembic autogenerate can discover it."""

from app.models.ranking import Ranking

__all__ = ["Ranking"]
