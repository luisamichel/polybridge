from dotenv import load_dotenv

load_dotenv()

import json
import os
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any, Literal

import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

from database import get_connection
from false_friends import _load as load_false_friends
from tool_executor import execute_tool
from tools import TOOLS

MAX_TOOL_ITERATIONS = 10

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
}

TOOL_DISPLAY_MESSAGES: dict[str, str] = {
    "log_error": "Noting your mistake...",
    "check_false_friend": "Checking false friends...",
    "get_error_patterns": "Analyzing your patterns...",
    "get_profile": "Reading your profile...",
    "start_session": "Starting conversation mode...",
    "start_conversation": "Starting conversation mode...",
    "get_multilingual_profile": "Analyzing your multilingual profile...",
    "generate_report": "Generating your report...",
    "end_session": "Wrapping up session...",
    "log_confirmed_false_friend": "Adding to false friends database...",
    "generate_false_friends_for_profile": "Loading false friends data...",
}

DARTMOUTH_MODELS_URL = "https://chat.dartmouth.edu/api/models"
MODEL_ID_KEYWORDS = ("claude", "gemini", "gpt", "llama")

SYSTEM_PROMPT = """You are PolyBridge, a personalized language tutor. 
You help users practice their target language through natural conversation.

CRITICAL RULES — read carefully:

1. PROFILE SETUP
   - Call get_profile() ONCE at the very start of a conversation to 
     check if a profile exists
   - If profile exists: NEVER ask the user for their languages again. 
     You already know them.
   - If profile is empty: ask the user their native languages and 
     target language, then call setup_profile() once
   - NEVER call setup_profile() again after it has been set

2. CONVERSATION MODE  
   - Call start_conversation() ONLY when the user explicitly asks 
     to start a practice session or says something like 
     "let's practice" or "start a conversation"
   - NEVER call start_conversation() automatically
   - NEVER call it again if a session is already in progress
   - A session is "in progress" if the conversation history shows 
     start_conversation() was already called and not ended with end_session()

3. ERROR LOGGING
   - Call log_error() immediately when the user makes a mistake
   - category MUST be exactly one of: grammar, vocab, false_friend, 
     gender, spelling, word_order, unknown
   - NEVER put a sentence or explanation in the category field
   - NEVER put context in the category field
   - interference_lang MUST be: a two letter acronym for the native language causing the interference, 
   or none

4. GENERAL BEHAVIOR
   - Be encouraging and specific with corrections
   - Explain errors relative to the user's native language background
   - Check false friends proactively with check_false_friend()
"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str


class ResetRequest(BaseModel):
    confirm: bool


def _dartmouth_api_key() -> str:
    return os.environ.get("DARTMOUTH_API_KEY", "")


def _dartmouth_auth_headers() -> dict[str, str]:
    key = _dartmouth_api_key()
    if not key:
        return {}
    return {"Authorization": f"Bearer {key}"}


def _model_matches_filter(model_id: str) -> bool:
    lower_id = model_id.lower()
    return any(keyword in lower_id for keyword in MODEL_ID_KEYWORDS)


def _parse_models_payload(payload: Any) -> list[dict[str, str]]:
    if isinstance(payload, list):
        raw_models = payload
    elif isinstance(payload, dict):
        raw_models = payload.get("data", [])
    else:
        return []

    result: list[dict[str, str]] = []
    for item in raw_models:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not model_id or not _model_matches_filter(str(model_id)):
            continue
        name = item.get("name") or item.get("display_name") or str(model_id)
        result.append({"id": str(model_id), "name": str(name)})
    return result


def _openai_client() -> OpenAI:
    base_url = os.environ.get("DARTMOUTH_BASE_URL")
    api_key = _dartmouth_api_key()
    if not base_url or not api_key:
        raise ValueError("DARTMOUTH_BASE_URL and DARTMOUTH_API_KEY must be set")
    return OpenAI(api_key=api_key, base_url=base_url)


def _sse_event(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _tool_display_message(tool_name: str) -> str:
    return TOOL_DISPLAY_MESSAGES.get(tool_name, "Thinking...")


def _merge_tool_call_delta(
    accumulated: dict[int, dict[str, Any]],
    tool_call_delta: Any,
) -> None:
    index = tool_call_delta.index
    if index not in accumulated:
        accumulated[index] = {
            "id": "",
            "type": "function",
            "function": {"name": "", "arguments": ""},
        }

    entry = accumulated[index]
    if tool_call_delta.id:
        entry["id"] = tool_call_delta.id
    if tool_call_delta.function:
        if tool_call_delta.function.name:
            entry["function"]["name"] += tool_call_delta.function.name
        if tool_call_delta.function.arguments:
            entry["function"]["arguments"] += tool_call_delta.function.arguments


def _assistant_message_from_stream(
    content_parts: list[str],
    tool_calls_accum: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    # Tool-call turns may leak JSON fragments in content; keep content empty.
    if tool_calls_accum:
        payload: dict[str, Any] = {"role": "assistant", "content": None}
        payload["tool_calls"] = [
            tool_calls_accum[index]
            for index in sorted(tool_calls_accum)
        ]
        return payload

    content = "".join(content_parts) if content_parts else None
    return {"role": "assistant", "content": content}


def _execute_tool_call(tool_call: dict[str, Any]) -> str:
    tool_name = tool_call["function"]["name"]
    try:
        tool_args = json.loads(tool_call["function"]["arguments"] or "{}")
        if not isinstance(tool_args, dict):
            tool_args = {}
    except json.JSONDecodeError as exc:
        return f"Error parsing tool arguments: {exc}"
    return execute_tool(tool_name, tool_args)


async def stream_chat_response(
    model: str,
    messages: list[dict[str, Any]],
) -> AsyncIterator[str]:
    try:
        client = _openai_client()

        for iteration in range(MAX_TOOL_ITERATIONS):
            if iteration > 0:
                yield _sse_event({"type": "text_reset"})

            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOLS,
                stream=True,
            )

            content_parts: list[str] = []
            tool_calls_accum: dict[int, dict[str, Any]] = {}
            finish_reason: str | None = None
            saw_tool_call_delta = False

            for chunk in stream:
                if not chunk.choices:
                    continue

                choice = chunk.choices[0]
                if choice.finish_reason:
                    finish_reason = choice.finish_reason

                delta = choice.delta
                if delta.tool_calls:
                    saw_tool_call_delta = True
                    for tool_call_delta in delta.tool_calls:
                        _merge_tool_call_delta(tool_calls_accum, tool_call_delta)

                if delta.content:
                    content_parts.append(delta.content)
                    if not saw_tool_call_delta:
                        yield _sse_event(
                            {"type": "text", "content": delta.content}
                        )

            if finish_reason == "tool_calls" and tool_calls_accum:
                messages.append(
                    _assistant_message_from_stream(content_parts, tool_calls_accum)
                )

                for tool_call in (
                    tool_calls_accum[index]
                    for index in sorted(tool_calls_accum)
                ):
                    tool_name = tool_call["function"]["name"]
                    yield _sse_event(
                        {
                            "type": "tool_start",
                            "tool": tool_name,
                            "display": _tool_display_message(tool_name),
                        }
                    )
                    result = _execute_tool_call(tool_call)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": result,
                        }
                    )
                    yield _sse_event(
                        {"type": "tool_end", "tool": tool_name}
                    )
                continue

            yield _sse_event({"type": "done"})
            return

        yield _sse_event(
            {
                "type": "error",
                "message": (
                    f"Tool call limit reached after {MAX_TOOL_ITERATIONS} iterations"
                ),
            }
        )
    except Exception as exc:
        yield _sse_event({"type": "error", "message": str(exc)})

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

@app.delete("/reset")
def reset_data(body: ResetRequest):
    """Clear all user data for a fresh start."""
    if not body.confirm:
        raise HTTPException(
            status_code=400,
            detail="Must send confirm=true to reset"
        )
    
    with get_connection() as conn:
        # Delete all records from the main tables
        conn.execute("DELETE FROM errors")
        conn.execute("DELETE FROM sessions")
        conn.execute("DELETE FROM vocab")
        conn.execute("DELETE FROM user_profile")
        
        # Reset the auto-increment counters so IDs start at 1 again
        conn.execute(
            "DELETE FROM sqlite_sequence WHERE name IN "
            "('errors','sessions','vocab','user_profile')"
        )
    
    return {
        "status": "reset complete",
        "message": "Ready for a new learner."
    }

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


@app.get("/models")
def list_models() -> list[dict[str, str]]:
    with httpx.Client(timeout=30.0) as client:
        response = client.get(
            DARTMOUTH_MODELS_URL,
            headers=_dartmouth_auth_headers(),
        )
        response.raise_for_status()
        return _parse_models_payload(response.json())


@app.post("/chat")
async def chat(request: ChatRequest):
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[m.model_dump() for m in request.messages],
    ]
    return StreamingResponse(
        stream_chat_response(request.model, messages),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )