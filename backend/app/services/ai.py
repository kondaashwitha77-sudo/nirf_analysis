"""AI narration: the model words a result that was already computed from the real data.

It never sees the database or the user's browser, only the question and the computed figures.
"""

import httpx

from app.core.config import Settings
from app.core.exceptions import AINotConfiguredError, AIUpstreamError
from app.core.logging import get_logger
from app.schemas.ai import NarrateRequest

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


def call_llm(settings: Settings, prompt: str) -> str:
    """POST to an OpenAI-compatible /chat/completions endpoint. Error text never includes the key."""
    if settings.ai_api_key is None or not settings.ai_api_key.get_secret_value().strip():
        raise AINotConfiguredError()
    try:
        response = httpx.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.ai_api_key.get_secret_value()}"},
            json={
                "model": settings.ai_model,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
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
