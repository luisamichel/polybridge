from typing import Any, Literal
import json
from collections import defaultdict

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection
from false_friends import _load as load_false_friends

app = FastAPI(title="PolyBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ReportPeriod = Literal["all_time", "this_week", "last_session"]

VALID_ERROR_CATEGORIES = frozenset(
    {"grammar", "vocab", "false_friend", "gender", "spelling"}
)

LANG_NAMES = {
    "EN": "English",
    "FR": "French",
    "ES": "Spanish",
    "PT": "Portuguese",
    "DE": "German",
    "IT": "Italian",
    "JA": "Japanese",
}


def _lang_name(code: str) -> str:
    return LANG_NAMES.get(code, code)


def _pair_subtitle(native_lang: str, target_lang: str) -> str:
    pair = (native_lang, target_lang)
    if pair == ("EN", "FR"):
        return "Faux Amis"
    if pair == ("EN", "ES"):
        return "Falsos Amigos"
    if pair in {("PT", "FR"), ("PT", "ES")}:
        return "Falsos Cognatos"
    return "False Friends"


def _get_profile_langs() -> tuple[list[str], str | None]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT target_language, native_languages FROM user_profile LIMIT 1"
        ).fetchone()
    if not row:
        return [], None
    return json.loads(row["native_languages"]), row["target_language"]


def _row_to_dict(row) -> dict[str, Any]:
    return dict(row)


def _rows_to_list(rows) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


@app.get("/profile")
def get_profile() -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM user_profile LIMIT 1").fetchone()
    return _row_to_dict(row) if row else {}


@app.get("/errors/patterns")
def get_error_patterns():
    with get_connection() as conn:
        by_category = conn.execute("""
            SELECT category, COUNT(*) as count
            FROM errors
            GROUP BY category
            ORDER BY count DESC
        """).fetchall()

        by_lang = conn.execute("""
            SELECT interference_lang, COUNT(*) as count
            FROM errors
            WHERE interference_lang NOT IN ('none', 'unknown', '')
            GROUP BY interference_lang
            ORDER BY count DESC
        """).fetchall()

        repeated = conn.execute("""
            SELECT mistake, correction, COUNT(*) as times
            FROM errors
            GROUP BY mistake
            HAVING times > 1
            ORDER BY times DESC
            LIMIT 5
        """).fetchall()

    return {
        "by_category": [dict(r) for r in by_category],
        "by_interference_lang": [dict(r) for r in by_lang],
        "repeated_mistakes": [dict(r) for r in repeated]
    }


@app.get("/errors")
def get_errors(limit: int = Query(50, ge=1, le=500)) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM errors ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return _rows_to_list(rows)


@app.get("/errors/recent-deck")
def get_recent_error_deck() -> list[dict[str, Any]]:
    placeholders = ", ".join("?" for _ in VALID_ERROR_CATEGORIES)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT mistake, correction, notes, category, interference_lang
            FROM errors
            WHERE category IN ({placeholders})
              AND timestamp >= datetime('now', '-7 days')
            ORDER BY timestamp DESC
            LIMIT 20
            """,
            tuple(VALID_ERROR_CATEGORIES),
        ).fetchall()

    return [
        {
            "front": row["mistake"],
            "back": row["correction"],
            "note": row["notes"],
            "category": row["category"],
            "interference_lang": row["interference_lang"],
        }
        for row in rows
    ]


@app.get("/false-friends/by-pair")
def get_false_friends_by_pair() -> list[dict[str, Any]]:
    native_langs, target_lang = _get_profile_langs()
    all_entries = load_false_friends()

    if target_lang and native_langs:
        relevant = [
            entry
            for entry in all_entries
            if entry["target_lang"] == target_lang
            and entry["native_lang"] in native_langs
        ]
    else:
        relevant = all_entries

    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for entry in relevant:
        key = (entry["native_lang"], entry["target_lang"])
        grouped[key].append(entry)

    return [
        {
            "native_lang": native,
            "target_lang": target,
            "label": f"{_lang_name(native)} ↔ {_lang_name(target)}",
            "subtitle": _pair_subtitle(native, target),
            "count": len(cards),
            "cards": cards,
        }
        for (native, target), cards in sorted(grouped.items())
    ]


@app.get("/false-friends")
def get_false_friends() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM vocab WHERE is_false_friend = 1 ORDER BY first_seen DESC"
        ).fetchall()
    return _rows_to_list(rows)


@app.get("/sessions")
def get_sessions() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY date DESC LIMIT 20"
        ).fetchall()
    return _rows_to_list(rows)


@app.get("/report")
def get_report(
    period: ReportPeriod = Query("all_time"),
) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM reports
            WHERE period = ?
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            (period,),
        ).fetchone()
    return _row_to_dict(row) if row else {}

@app.get("/health")
def health():
    return {"status": "ok"}