# NIRF Insights (frontend)

React + Vite + TypeScript + Tailwind + Plotly. **Frontend only** — all data is generated demo data
(fictional institution names) and is labelled "Demo / Mock Data" throughout.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # type-check + production build

## Architecture
- `src/data/mock/`     seeded mock dataset and local analysis engines (replace with the API)
- `src/services/`      Axios client + one function per future endpoint (mock fallback while VITE_USE_MOCK != false)
- `src/components/`    layout shell, reusable UI, Plotly wrapper (`PlotChart`, `SpecChart`, `ChartCard`)
- `src/pages/`         the 13 routes + 404
- `src/types/`         shared types, including `ChartSpec` (what the backend will return for charts)

## Connecting FastAPI later
Set `VITE_USE_MOCK=false` and `VITE_API_BASE_URL`. Endpoints expected:
`POST /visualization/query`, `POST /ai/query`, `POST /questions/{id}/execute`, `GET /data-quality`.
No AI key belongs in this codebase.

## Notes
- Question wording in `src/data/mock/questions.ts` is placeholder; paste the exact Annexure A text.
- The map is a bubble map on approximate state centroids; a true state choropleth needs GeoJSON from the backend.
- Absent values are `null` with a reason (missing / not published / not applicable / parser failure / invalid) — never 0.
