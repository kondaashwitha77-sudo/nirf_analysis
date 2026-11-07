"""AI narration: the model words a result that was already computed from the real data.

It never sees the database or the user's browser, only the question and the computed figures.
"""

import json
import re

import httpx

from app.core.config import Settings
from app.core.exceptions import AINotConfiguredError, AIUpstreamError
from app.core.logging import get_logger
from app.schemas.ai import NarrateRequest, PlanRequest

logger = get_logger(__name__)

SYSTEM_PROMPT = (
    "You are a careful data analyst explaining NIRF (India's National Institutional Ranking Framework) "
    "results, 2017-2025. Use ONLY the figures provided. Do not invent numbers or institutions. "
    "A lower rank number is better. If the figures do not answer the question, say so plainly. "
    "Answer in 3 to 5 short sentences, in plain language, and mention one caveat if it matters."
)


def build_prompt(req: NarrateRequest) -> str:
    lines = [f"Question: {req.question}", f"Computed summary: {req.summary}"]
    if req.filters:
        lines.append("Filters: " + "; ".join(f"{f.get('label')}={f.get('value')}" for f in req.filters))
    if req.rows:
        cols = req.columns or list(req.rows[0].keys())
        lines.append("Table (first rows):")
        lines.append(" | ".join(cols))
        for row in req.rows:
            lines.append(" | ".join("" if row.get(c) is None else str(row.get(c)) for c in cols))
    return "\n".join(lines)


def call_llm(settings: Settings, prompt: str, system: str | None = None, json_mode: bool = False) -> str:
    """POST to an OpenAI-compatible /chat/completions endpoint. Error text never includes the key."""
    if settings.ai_api_key is None or not settings.ai_api_key.get_secret_value().strip():
        raise AINotConfiguredError()
    try:
        response = httpx.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.ai_api_key.get_secret_value()}"},
            json={
                "model": settings.ai_model,
                "temperature": 0.0 if json_mode else 0.2,
                "messages": [
                    {"role": "system", "content": system or SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                **({"response_format": {"type": "json_object"}} if json_mode else {}),
            },
            timeout=settings.ai_timeout_seconds,
        )
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        logger.warning("AI request failed: %s", type(exc).__name__)
        raise AIUpstreamError() from exc
    if not isinstance(text, str) or not text.strip():
        raise AIUpstreamError()
    return text.strip()


def narrate(settings: Settings, req: NarrateRequest) -> str:
    return call_llm(settings, build_prompt(req))


PLAN_SYSTEM_PROMPT = """You are the query planner of a NIRF (India's National Institutional Ranking Framework) analytics dashboard.
Data: yearly NIRF rankings 2017-2025. Per institution, category and year: rank (1 is best), overall score, and five parameter scores:
TLR (Teaching, Learning & Resources), RPC (Research & Professional Practice), GO (Graduation Outcomes), OI (Outreach & Inclusivity), Perception.
You do NOT answer from memory and you never invent numbers. You only translate the user's question into ONE JSON object (a plan); the application
runs the plan on the real data. Understand any wording, typos, "and"/"or" lists, abbreviations (IITM = IIT Madras), and multiple years.
Reply with JSON only, no prose, in this shape:
{
 "intent": "query" | "annex" | "chat" | "clarify" | "unsupported",
 "reply": "text for chat / clarify / unsupported (otherwise empty)",
 "options": ["clickable follow-up questions when intent is clarify (max 4)"],
 "query": {
   "op": "top" | "bottom" | "aggregate" | "trend" | "correlation" | "lookup",
   "metric": "score" | "rank" | "TLR" | "RPC" | "GO" | "OI" | "Perception",
   "metric2": "second metric, only for op=correlation",
   "agg": "count" | "mean" | "median" | "min" | "max" | "sum"   (only for op=aggregate),
   "groupBy": "none" | "state" | "category" | "year" | "institution",
   "categories": ["exact category names from the allowed list; [] = not specified"],
   "years": [2017, ...]   (explicit list; expand ranges such as 2020-2023 or "last three years"; [] = latest year),
   "states": ["exact state names"],
   "institutions": ["institution names as the user wrote them, expanded where obvious"],
   "topN": number (how many rows to list / the rank cut-off for count questions such as "top 100"),
   "rankMax": number | null (only institutions ranked at or better than this),
   "institutionType": "IIT" | "NIT" | "IIIT" | "IISER" | "AIIMS" | "" (when the user means a family of institutions)
 },
 "annex": { "id": "1.1".."8.5", "args": { "category": "", "year": 0, "year2": 0, "state": "", "state2": "", "institutions": [], "param": "", "param2": "", "attrX": "", "attrY": "", "topN": 0, "minYears": 0, "bandSize": 0, "cut": 0, "z": 0, "pctHigh": 0, "pctLow": 0 } }
}
Choosing the intent:
- "query": a direct question about values, rankings, counts, averages, trends, comparisons, correlations or lookups of institutions/states/categories.
  op=top: "which institution has the highest X" (topN=1 for a single winner, or the requested number). op=bottom: lowest.
  op=aggregate: "how many", "average", "median", "per state/category/year" (agg + groupBy). op=trend: how something changed over years.
  op=correlation: relationship between two metrics. op=lookup: a named institution's values.
  "highest/best/lowest" with a metric means that metric, NOT overall score. "TLR" means metric TLR. Rank: lower number is better.
- "annex": the question matches one of the 40 analysis questions below better than a plain query (multi-step analyses). Fill args; omit what is not stated.
  1.1 rank history of institution(s) | 1.2 greatest improvement in rank | 1.3 largest decline in rank | 1.4 average score over time | 1.5 consistently in top N across years
  2.1 states with most institutions in top N | 2.2 geographic distribution change over years | 2.3 states improving representation | 2.4 compare two states' rankings | 2.5 states with most newly appearing institutions
  3.1 score distribution (year) | 3.2 distribution of ranks | 3.3 mean/median/min/max score | 3.4 score quartile shares | 3.5 spread across categories
  4.1 RPC vs overall | 4.2 Perception vs overall | 4.3 strongest parameter correlation with overall | 4.4 TLR vs RPC | 4.5 research-overall correlation over years | 4.x any two attributes scatter (attrX, attrY)
  5.1 top five across all five parameters | 5.2 high research, low teaching | 5.3 high teaching, low perception | 5.4 improved overall despite a parameter decline | 5.5 largest gap strongest/weakest parameter
  6.1 top 10 vs rest distribution | 6.2 dispersion across years | 6.3 most variable parameter | 6.4 median & IQR over time | 6.5 score distribution across states
  7.1 moved from 51-100 into top 50 | 7.2 entered/exited top 10 | 7.3 share staying in same rank band | 7.4 largest up/down rank movements | 7.5 up/down/same counts each year
  8.1 high research relative to overall (outliers) | 8.2 research much better than teaching | 8.3 unusually large score change | 8.4 strong parameter but poor rank | 8.5 high ranking volatility
- "chat": greetings, thanks, "what is TLR", how to use the dashboard, who you are. Put the answer in reply (explain NIRF terms correctly; never invent data).
- "clarify": only when the question cannot be run without a guess that would change the answer. Give 2-4 concrete options (full questions).
  Do NOT clarify just because a year/category is missing: default to the latest year and "Overall".
- "unsupported": clearly outside this dataset (weather, fees, placements, other countries...). Say so in reply and suggest a possible question in options.
Rules: use only category and state names from the allowed lists. Years must be within the available years. If the user continues a previous
question ("what about 2023?", "same for pharmacy"), start from previous_plan and change only what they changed. Never put numbers or rankings of
institutions in reply."""


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        data = json.loads(text)
    except ValueError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise AIUpstreamError()
        try:
            data = json.loads(m.group(0))
        except ValueError as exc:
            raise AIUpstreamError() from exc
    if not isinstance(data, dict):
        raise AIUpstreamError()
    return data


def plan(settings: Settings, req: PlanRequest) -> dict:
    """Turn a free-form question into a JSON plan. The model never sees institution data and never computes numbers."""
    lines = [
        f"Allowed categories: {', '.join(req.categories)}",
        f"Allowed states: {', '.join(req.states)}",
        f"Available years: {', '.join(str(y) for y in req.years)} (latest {max(req.years) if req.years else ''})",
    ]
    if req.previous_plan:
        lines.append("previous_plan: " + json.dumps(req.previous_plan)[:1500])
    lines.append("Question: " + req.question)
    raw = call_llm(settings, "\n".join(lines), system=PLAN_SYSTEM_PROMPT, json_mode=True)
    data = _extract_json(raw)
    if data.get("intent") not in {"query", "annex", "chat", "clarify", "unsupported"}:
        raise AIUpstreamError()
    return data
