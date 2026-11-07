"""Load the cleaned NIRF CSV into the configured database.

Run from the backend folder, after `alembic upgrade head`:
    python -m scripts.load_data
    python -m scripts.load_data --csv data/nirf_rankings.csv
"""

import argparse
from pathlib import Path

from app.core.config import get_settings
from app.db.session import create_db_engine, create_session_factory
from app.services.data_loader import load_rankings

DEFAULT_CSV = Path(__file__).resolve().parent.parent / "data" / "nirf_rankings.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()

    engine = create_db_engine(get_settings().database_url)
    try:
        with create_session_factory(engine)() as session:
            count = load_rankings(session, args.csv)
        print(f"Loaded {count} rows from {args.csv}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
