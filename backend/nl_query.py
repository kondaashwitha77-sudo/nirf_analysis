"""Natural-language -> safe query plan -> pandas, powered by Grok (xAI API).

Why a JSON "plan" instead of letting the model write pandas code?
  * Grok only returns a small JSON spec (filters / group / sort / limit).
  * WE execute it with a whitelist of fields and operators, so a bad or
    malicious prompt can never run arbitrary code on your machine.
"""
import json
import os
import re

import httpx
import pandas as pd

from data_store import DF, FIELDS, PARAMS, to_records

XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-4")

NUMERIC = {"year", "rank", "rank_base", "score", *PARAMS}
OPS = {"eq", "ne", "in", "gt", "gte", "lt", "lte", "contains"}
AGGS = {"mean", "count", "max", "min", "sum", "nunique", "median"}

CATEGORIES = sorted(DF["category"].unique())
STATES = sorted(DF["state"].dropna().unique())

SYSTEM_PROMPT = f"""You translate questions about the NIRF (National Institutional Ranking Framework, India) rankings 2017-2025 into a JSON query plan. Output ONLY one JSON object, no prose.

DATA: one row per (year, category, institution). Columns:
year(int 2017-2025), category, rank(int, exact rank, null for ties like '26A'), rank_base(int, ALWAYS use this for rank filters/sorts; 26A -> 26),
institution_name, institution_id, city, state, score(float, null for some), TLR, RPC, GO, OI, PERCEPTION (float 0-100 parameter scores; Research category has no TLR/RPC/GO).
categories = {CATEGORIES}
states = {STATES}

PLAN SCHEMA:
{{
  "filters": [{{"field": <column>, "op": "eq|ne|in|gt|gte|lt|lte|contains", "value": <value or list for 'in'>}}],
  "group_by": [<column>, ...] or null,
  "aggregate": {{"field": <column>, "fn": "mean|count|max|min|sum|nunique|median", "as": <name>}} or null,
  "sort": {{"field": <column or aggregate name>, "order": "asc|desc"}} or null,
  "limit": <int, default 20, max 200>,
  "columns": [<columns to show>] or null,
  "chart": "bar|line|table"
}}

RULES:
- If the user gives no category, use category = "Overall". If no year, do not filter year unless the question implies the latest (then 2025).
- "contains" on institution_name is case-insensitive. ALWAYS expand abbreviations to official words: IIT Madras -> "Indian Institute of Technology Madras", IISc -> "Indian Institute of Science", NIT Trichy -> "National Institute of Technology", AIIMS -> "All India Institute of Medical Sciences", JNU -> "Jawaharlal Nehru University", BHU -> "Banaras Hindu University". For short ambiguous names add a state or city filter.
- Top N: filter rank_base lte N (or sort rank_base asc + limit N). Rank band "51-100": rank_base gte 51 and lte 100.
- "Improved/declined over time" or "trend": filter the institution(s), sort by year asc, columns [year, institution_name, rank_base, score], chart "line".
- Counting institutions per state/category: group_by [state] with aggregate count of institution_id (use nunique).
- Use state names exactly as in the list (e.g. "Tamil Nadu", "Uttar Pradesh").
- Rank 1 = best. "Highest score" -> sort score desc.
"""


class PlanError(Exception):
    pass


def _call_grok(messages, json_mode=True):
    key = os.getenv("XAI_API_KEY", "").strip()
    if not key or key.startswith("paste_"):
        raise PlanError("XAI_API_KEY is not set. Put your Grok key in backend/.env")
    body = {"model": XAI_MODEL, "messages": messages, "temperature": 0}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    r = httpx.post(
        f"{XAI_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json=body,
        timeout=60,
    )
    if r.status_code != 200:
        raise PlanError(f"Grok API error {r.status_code}: {r.text[:300]}")
    return r.json()["choices"][0]["message"]["content"]


def _parse_json(text: str) -> dict:
    text = text.strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise PlanError("Grok did not return JSON")
    return json.loads(m.group(0))


def make_plan(question: str, history=None) -> dict:
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in (history or [])[-4:]:
        msgs.append({"role": h["role"], "content": h["content"]})
    msgs.append({"role": "user", "content": question})
    return _parse_json(_call_grok(msgs))


def _check_field(f):
    if f not in FIELDS:
        raise PlanError(f"Unknown column '{f}'")
    return f


def execute_plan(plan: dict):
    df = DF
    for flt in plan.get("filters") or []:
        f, op, v = _check_field(flt.get("field")), flt.get("op"), flt.get("value")
        if op not in OPS:
            raise PlanError(f"Bad operator '{op}'")
        col = df[f]
        if op == "contains":
            df = df[col.astype(str).str.contains(re.escape(str(v)), case=False, na=False)]
        elif op == "in":
            vals = v if isinstance(v, list) else [v]
            df = df[col.isin(vals)]
        else:
            if f in NUMERIC:
                v = float(v)
            elif isinstance(v, str):
                # case-insensitive equality for text
                low = col.astype(str).str.lower()
                v = v.lower()
                mask = {"eq": low == v, "ne": low != v}.get(op)
                if mask is None:
                    raise PlanError("Only eq/ne/in/contains work on text columns")
                df = df[mask]
                continue
            df = df[{"eq": col == v, "ne": col != v, "gt": col > v, "gte": col >= v,
                     "lt": col < v, "lte": col <= v}[op]]

    agg = plan.get("aggregate")
    group = [_check_field(g) for g in (plan.get("group_by") or [])]
    if agg:
        fld, fn = _check_field(agg.get("field")), agg.get("fn")
        if fn not in AGGS:
            raise PlanError(f"Bad aggregate '{fn}'")
        name = re.sub(r"\W", "_", agg.get("as") or f"{fn}_{fld}")
        if group:
            res = df.groupby(group, dropna=False)[fld].agg(fn).reset_index(name=name)
        else:
            res = pd.DataFrame({name: [df[fld].agg(fn)]})
        df = res
    sort = plan.get("sort")
    if sort and sort.get("field") in df.columns:
        df = df.sort_values(sort["field"], ascending=(sort.get("order") == "asc"), kind="stable")
    limit = max(1, min(int(plan.get("limit") or 20), 200))
    total = len(df)
    df = df.head(limit)
    cols = plan.get("columns")
    if cols and not agg:
        cols = [c for c in cols if c in df.columns]
    else:
        cols = list(df.columns) if agg else ["year", "category", "rank_base", "institution_name", "state", "score"]
    return df, cols, total


def answer(question: str, history=None) -> dict:
    plan = make_plan(question, history)
    df, cols, total = execute_plan(plan)
    rows = to_records(df, cols) if not any(c not in FIELDS for c in cols) else \
        json.loads(df[cols].to_json(orient="records"))
    summary = ""
    try:
        summary = _call_grok(
            [
                {"role": "system", "content": "You are a data analyst. Answer the question in 1-3 short sentences using ONLY the rows given. Ranks: 1 is best. If rows are empty say no matching data was found. Do not invent numbers."},
                {"role": "user", "content": f"Question: {question}\nRows ({total} matched, first {len(rows)} shown): {json.dumps(rows[:40], default=str)}"},
            ],
            json_mode=False,
        ).strip()
    except PlanError:
        summary = f"{total} matching rows."
    return {"question": question, "answer": summary, "plan": plan, "columns": cols,
            "rows": rows, "total_matched": total, "chart": plan.get("chart", "table")}
