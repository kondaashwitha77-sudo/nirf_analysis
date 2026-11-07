# NIRF Insights — Backend (Phase 1: Foundation)

FastAPI + SQLAlchemy 2 backend for the NIRF Insights dashboard. This phase provides infrastructure
only: configuration, logging, error handling, database plumbing, migrations, and health endpoints.
NIRF domain tables, analytics, the Annexure A questions, the visualization engine and AI come in
later phases.

- **Python:** 3.11 or newer (developed and tested on 3.13)
- **Stack:** FastAPI, Uvicorn, Pydantic v2, pydantic-settings, SQLAlchemy 2.x, Alembic, Pandas, NumPy
- **Database:** SQLite for local development; PostgreSQL-compatible configuration

## Folder structure

```text
backend/
├── app/
│   ├── main.py              App factory (create_app), CORS, request logging, lifespan
│   ├── api/
│   │   ├── router.py        Aggregates all route modules (add new routers here)
│   │   └── routes/health.py GET /api/health, GET /api/health/ready
│   ├── core/
│   │   ├── config.py        Settings (env vars + .env)
│   │   ├── logging.py       Centralised logging
│   │   └── exceptions.py    AppError types + handlers -> standard error body
│   ├── db/
│   │   ├── base.py          Declarative Base (with constraint naming convention)
│   │   ├── session.py       Engine and session-factory builders (SQLite/PostgreSQL aware)
│   │   └── dependencies.py  get_db: one session per request, rollback on error, always closed
│   ├── schemas/             Pydantic response models
│   ├── models/              ORM models (empty until the canonical schema is finalised)
│   └── services/            Business logic (health check for now)
├── alembic/                 Migration environment (reads the URL from app settings)
├── tests/                   pytest suite (temporary SQLite database per test)
├── .env.example
├── alembic.ini
├── pytest.ini
├── requirements.txt
└── run.py
```

There is no global engine or session. The app builds them at startup, keeps them on `app.state`,
and routes get sessions through `Depends(get_db)`.

## Setup (Windows PowerShell)

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks the activate script, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use Command Prompt with
`venv\Scripts\activate.bat`.

macOS / Linux: `python3 -m venv venv && source venv/bin/activate`, then the same `pip` and `cp` steps.

## Configuration

Settings come from environment variables or `backend/.env`. Never commit `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `APP_NAME` | `NIRF Insights API` | Title shown in docs and health |
| `APP_VERSION` | `1.0.0` | API version |
| `ENVIRONMENT` | `development` | `development`, `testing` or `production` |
| `DEBUG` | `false` | Auto-reload; adds error detail to 500 responses. Keep **false** in production |
| `API_PREFIX` | `/api` | URL prefix for all API routes (matches the frontend default) |
| `DATABASE_URL` | `sqlite:///./nirf_insights.db` | Any SQLAlchemy URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Used by `python run.py` |

### Database

SQLite is the default. The path in `sqlite:///./nirf_insights.db` is relative to the folder you run
the server from, so run it from `backend/`. SQLite is configured for FastAPI (`check_same_thread`
off, foreign keys on).

To move to PostgreSQL later, install a driver and change only `DATABASE_URL`:

```powershell
pip install "psycopg[binary]"
# .env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/nirf_insights
```

## Migrations (Alembic)

No tables exist yet, so there are no revisions. The environment is ready for them:

```powershell
alembic current                                  # show applied revision
alembic revision --autogenerate -m "describe change"   # after adding models
alembic upgrade head                             # apply migrations
alembic downgrade -1                             # undo the last one
alembic -x db_url=sqlite:///./other.db upgrade head    # target another database once
```

Add each new model module to `app/models/__init__.py` so autogenerate can see it.

## Load the NIRF dataset

The cleaned dataset (6,884 rows, 2017-2025) is in `data/nirf_rankings.csv`. Create the table, then load it
(re-running replaces the rows, so it is safe to repeat):

```powershell
alembic upgrade head
python -m scripts.load_data
```

To use a different file: `python -m scripts.load_data --csv path\to\file.csv`.
Blank cells are stored as NULL (missing), never as 0.

## Run the server

```powershell
python run.py
# or
uvicorn app.main:app --reload
```

- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | API name, version and links |
| GET | `/api/health` | Runs `SELECT 1`; `{"status":"healthy","application":"NIRF Insights API","database":"connected"}` |
| GET | `/api/health/ready` | Readiness, including database connectivity |
| GET | `/api/meta` | Years, categories, zones, states, institution types, row counts |
| GET | `/api/rankings` | Records. Filters: `year`, `category`, `state`, `zone`, `institution_type`, `q` (name or city), `limit` (max 500), `offset`. Sorted by rank, unranked last |
| GET | `/api/institutions/{canonical_id}` | One institution across all years (404 if unknown) |

When the database is down, both health routes return **503**:

```json
{ "success": false, "error": { "code": "DATABASE_UNAVAILABLE", "message": "Database connection could not be established" } }
```

All errors share the `{ "success": false, "error": { "code", "message", "details?" } }` shape
(validation, HTTP, database and unexpected errors). Stack traces, paths and credentials are written
to the server log only, never returned to clients (unless `DEBUG=true`, which adds the exception
type and message to 500 responses).

## Connect the frontend

The React app already calls `/api`. Create `.env.local` in the frontend folder:

```text
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

CORS already allows `http://localhost:5173`. Restart `npm run dev` after changing env files.
(Only health endpoints exist so far; the frontend keeps using mock data for everything else
until the analytics phases add real endpoints.)

## Tests

```powershell
python -m pytest
```

Each test uses its own temporary SQLite database; the real `nirf_insights.db` is never touched.
Coverage: startup/shutdown, root, health, readiness, a real `SELECT 1` being executed, unavailable
database (503 + no leaked details), standard error shapes (404/405/422/500), debug vs production
error detail, session rollback/close, CORS, prefix configuration, and Swagger/OpenAPI availability.
