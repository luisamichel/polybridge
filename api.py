from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

import json
import logging
import os
import traceback
import urllib.request
import urllib.error
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Any, Literal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

from database import get_connection
from false_friends import _load as load_false_friends, get_for_profile
from tool_executor import execute_tool
from tools import TOOLS

ANKI_CONNECT_URL = "http://localhost:8765"


def anki_request(action: str, **params) -> dict:
    """Send a request to AnkiConnect and return the response."""
    request_data = {"action": action, "version": 6, "params": params}
    data_json = json.dumps(request_data).encode("utf-8")

    try:
        req = urllib.request.Request(
            ANKI_CONNECT_URL,
            data=data_json,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode("utf-8"))

        if response_data.get("error"):
            raise HTTPException(
                status_code=500,
                detail=f"AnkiConnect error: {response_data['error']}"
            )

        return response_data.get("result", response_data)
    except urllib.error.URLError:
        raise HTTPException(
            status_code=503,
            detail="Anki is not running. Please open Anki and try again."
        )


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
    "is_session_active": "Checking session status...",
    "start_session": "Starting practice session...",
    "start_conversation": "Starting conversation mode...",
    "get_multilingual_profile": "Analyzing your multilingual profile...",
    "generate_report": "Generating your report...",
    "end_session": "Wrapping up session...",
    "log_confirmed_false_friend": "Adding to false friends database...",
    "generate_false_friends_for_profile": "Loading false friends data...",
    "log_vocab_lookup": "Saving word to vocabulary...",
    "get_vocab_list": "Retrieving vocabulary list...",
}

DARTMOUTH_MODELS_URL = "https://chat.dartmouth.edu/api/models"
MODEL_ID_KEYWORDS = ("claude", "gemini", "gpt", "llama")
EXCLUDED_MODELS = {
    "Llama 3.2 11b",
    "Claude Opus 4.6",
    "Claude Opus 4.7",
    "Claude Opus 4.8",
    "Claude Sonnet 4.6",
    "GPT 5.3 Instant",
    "GPT 5.4 2026-03-05",
    "GPT 5.4 Mini 2026-03-17",
    "GPT-5.5-2026-04-23",
    "Llama 3.2 3b",
    "google_genai.gemini-embedding-001",
    "CodeLlama 13b Instruct HF",
}

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

2. SESSION MANAGEMENT
   - Call start_session() ONLY when the user explicitly asks to start a
     practice session or says something like "let's practice" or "start a session"
   - NEVER call start_session() automatically
   - If you're unsure whether a session is already active, you may call
     is_session_active() to check, but do not call start_session() if it returns true
   - Do NOT call start_session() while a session is already active, even if
     the user changes the topic of the conversation
   - Call end_session() when the user finishes practicing

3. ERROR LOGGING
   - Call log_error() immediately when the user makes a mistake
   - category MUST be exactly one of: grammar, vocab, false_friend,
     gender, spelling, word_order, unknown
   - interference_lang MUST be: a two letter acronym for the native language causing the interference,
   or none

4. VOCABULARY TRACKING
   - Call log_vocab_lookup() when the user asks about a word's meaning
   - This saves words to their vocabulary list for later review
   - Examples: "what does X mean?", "how do you say X?", user looks confused about a word
   - Call get_vocab_list() when the user wants to review their saved vocabulary

5. GENERAL BEHAVIOR
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


class CreateDeckRequest(BaseModel):
    deck_name: str


class Card(BaseModel):
    front: str
    back: str
    tags: list[str] = []


class AddCardsRequest(BaseModel):
    deck_name: str
    cards: list[Card]


class ExportDeckRequest(BaseModel):
    deck_type: str  # "false_friends", "vocab", "mistakes"
    deck_name: str | None = None


class SwitchDatabaseRequest(BaseModel):
    db: str  # "polyglot.db" or "demo_luisa.db"


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
        
        # Filter out excluded models
        if str(model_id) in EXCLUDED_MODELS or str(name) in EXCLUDED_MODELS:
            continue
        
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


def _is_valid_json(text: str) -> bool:
    """Check if a string is valid JSON."""
    try:
        json.loads(text)
        return True
    except (json.JSONDecodeError, ValueError):
        return False


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
            content_buffer: list[str] = []
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
                    # Buffer content instead of yielding immediately
                    content_buffer.append(delta.content)

            # Yield buffered content only if no tool calls were detected
            if not saw_tool_call_delta and content_buffer:
                for chunk in content_buffer:
                    # Filter out JSON-like content
                    stripped = chunk.strip()
                    if stripped.startswith("{") and _is_valid_json(stripped):
                        continue
                    yield _sse_event({"type": "text", "content": chunk})

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
    allow_origins=[
        "http://localhost:3000",
        "https://polybridge-rho.vercel.app",
        "https://*.vercel.app",],
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


@app.get("/current-db")
def get_current_db():
    """Return the currently active database name."""
    return {"db": os.getenv("POLYBRIDGE_DB", "polyglot.db")}


@app.post("/switch-db")
def switch_database(body: SwitchDatabaseRequest):
    """Switch to a different database file."""
    # Validate db name against allowlist to prevent directory traversal
    allowed_dbs = {"polyglot.db", "demo_luisa.db", "demo_spanish.db"}
    if body.db not in allowed_dbs:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid database name. Must be one of: {', '.join(sorted(allowed_dbs))}"
        )

    # Check if the database file exists
    db_path = Path(__file__).parent / "data" / body.db
    if not db_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Database file '{body.db}' not found in data/ directory"
        )

    # Update .env file
    env_path = Path(__file__).parent / ".env"
    try:
        # Read current .env content
        env_content = env_path.read_text()

        # Update or add POLYBRIDGE_DB line
        lines = env_content.split('\n')
        updated_lines = []
        db_line_updated = False

        for line in lines:
            if line.startswith("POLYBRIDGE_DB="):
                updated_lines.append(f"POLYBRIDGE_DB={body.db}")
                db_line_updated = True
            else:
                updated_lines.append(line)

        if not db_line_updated:
            updated_lines.append(f"POLYBRIDGE_DB={body.db}")

        # Write back to .env
        env_path.write_text('\n'.join(updated_lines))

        # Reload environment variables
        load_dotenv(override=True)

        return {
            "status": "success",
            "message": f"Switched to {body.db}",
            "current_db": body.db
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to switch database: {str(e)}"
        )

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


@app.get("/vocab/lookups")
def get_vocab_lookups(limit: int = Query(50, ge=1, le=500)) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, word, translation, target_language, first_seen, cognate_in as notes
            FROM vocab
            WHERE is_false_friend = 0
            ORDER BY first_seen DESC
            LIMIT ?
            """,
            (limit,),
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


@app.get("/anki/status")
def get_anki_status() -> dict[str, Any]:
    """Check if AnkiConnect is running."""
    try:
        anki_request("version")
        return {"connected": True, "version": 6}
    except HTTPException:
        return {"connected": False}


@app.post("/anki/create-deck")
def create_anki_deck(request: CreateDeckRequest) -> dict[str, Any]:
    """Create a deck in Anki."""
    anki_request("createDeck", deck=request.deck_name)
    return {"created": True, "deck": request.deck_name}


@app.post("/anki/add-cards")
def add_anki_cards(request: AddCardsRequest) -> dict[str, Any]:
    """Add multiple cards to an Anki deck."""
    logger.info(f"Adding {len(request.cards)} cards to deck: {request.deck_name}")
    # Ensure deck exists
    anki_request("createDeck", deck=request.deck_name)

    # Build notes for bulk add
    notes = [
        {
            "deckName": request.deck_name,
            "modelName": "Basic",
            "fields": {"Front": card.front, "Back": card.back},
            "tags": card.tags,
            "options": {"allowDuplicate": False}
        }
        for card in request.cards
    ]

    # Try bulk add first
    try:
        result = anki_request("addNotes", notes=notes)

        # Count successfully added notes and track which indices succeeded
        added_count = 0
        successful_indices: list[int] = []
        if isinstance(result, list):
            for index, item in enumerate(result):
                if isinstance(item, int):
                    added_count += 1
                    successful_indices.append(index)

        logger.info(f"Successfully added {added_count} cards via bulk add")
        return {"added": added_count, "deck": request.deck_name, "successful_indices": successful_indices}

    except HTTPException as e:
        # Check if it's a duplicate error
        error_detail = str(e.detail)
        if "duplicate" in error_detail.lower():
            logger.info(f"Bulk add failed due to duplicates, adding cards individually")
            # Fall back to individual card addition
            added_count = 0
            successful_indices: list[int] = []

            for index, card in enumerate(request.cards):
                try:
                    single_note = [
                        {
                            "deckName": request.deck_name,
                            "modelName": "Basic",
                            "fields": {"Front": card.front, "Back": card.back},
                            "tags": card.tags,
                            "options": {"allowDuplicate": False}
                        }
                    ]
                    result = anki_request("addNotes", notes=single_note)
                    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], int):
                        added_count += 1
                        successful_indices.append(index)
                        logger.info(f"Successfully added card {index + 1}/{len(request.cards)}")
                    else:
                        logger.info(f"Skipped duplicate card {index + 1}/{len(request.cards)}")
                except HTTPException as single_error:
                    if "duplicate" in str(single_error.detail).lower():
                        logger.info(f"Skipped duplicate card {index + 1}/{len(request.cards)}")
                    else:
                        logger.error(f"Failed to add card {index + 1}/{len(request.cards)}: {single_error.detail}")

            logger.info(f"Successfully added {added_count} cards via individual add")
            return {"added": added_count, "deck": request.deck_name, "successful_indices": successful_indices}
        else:
            # Re-raise non-duplicate errors
            raise


@app.post("/anki/export-deck")
def export_anki_deck(request: ExportDeckRequest) -> dict[str, Any]:
    """Export PolyBridge data to Anki based on deck_type."""
    try:
        logger.info(f"Exporting deck_type: {request.deck_type}, deck_name: {request.deck_name}")
        deck_name = request.deck_name
        cards: list[Card] = []
        exported_ids: list[int] = []  # Track IDs to mark as exported

        if request.deck_type == "false_friends":
            if not deck_name:
                deck_name = "PolyBridge::False Friends"

            native_langs, target_lang = _get_profile_langs()
            if not native_langs or not target_lang:
                raise HTTPException(
                    status_code=400,
                    detail="Profile not set. Please set your native and target languages first."
                )

            # Get false friends that haven't been exported yet
            with get_connection() as conn:
                rows = conn.execute(
                    """
                    SELECT id, word, translation, target_language, cognate_in
                    FROM vocab
                    WHERE is_false_friend = 1 AND anki_exported = 0
                    """
                ).fetchall()

            # Filter by profile languages
            false_friends = []
            for row in rows:
                if row["target_language"] == target_lang and any(
                    lang in row["cognate_in"] or "" for lang in native_langs
                ):
                    false_friends.append(dict(row))

            for ff in false_friends:
                exported_ids.append(ff["id"])
                native_lang = next(
                    (lang for lang in native_langs if lang in (ff["cognate_in"] or "")),
                    native_langs[0] if native_langs else "EN"
                )
                native_lang_name = _lang_name(native_lang)
                cards.append(Card(
                    front=f"⚠️ {ff['word']}\n({native_lang_name} speaker trap)",
                    back=f"Means: {ff['translation']}\n\nTrap: {ff['cognate_in'] or 'None'}",
                    tags=["polybridge", "false-friend", native_lang.lower()]
                ))

        elif request.deck_type == "vocab":
            if not deck_name:
                deck_name = "PolyBridge::Vocabulary"

            with get_connection() as conn:
                rows = conn.execute(
                    "SELECT id, word, translation, cognate_in FROM vocab WHERE is_false_friend = 0 AND anki_exported = 0"
                ).fetchall()

            for row in rows:
                exported_ids.append(row["id"])
                notes = row["cognate_in"] or ""
                cards.append(Card(
                    front=row["word"],
                    back=f"{row['translation']}\n\n{notes}" if notes else row["translation"] or "",
                    tags=["polybridge", "vocabulary"]
                ))

        elif request.deck_type == "mistakes":
            if not deck_name:
                deck_name = "PolyBridge::Mistakes"

            placeholders = ", ".join("?" for _ in VALID_ERROR_CATEGORIES)
            with get_connection() as conn:
                # Deduplicate by (mistake, correction), keeping only the most recent
                rows = conn.execute(
                    f"""
                    SELECT id, mistake, correction, notes, category
                    FROM errors
                    WHERE id IN (
                        SELECT MAX(id)
                        FROM errors
                        WHERE category IN ({placeholders})
                          AND timestamp >= datetime('now', '-7 days')
                          AND anki_exported = 0
                        GROUP BY mistake, correction
                    )
                    ORDER BY timestamp DESC
                    LIMIT 20
                    """,
                    tuple(VALID_ERROR_CATEGORIES),
                ).fetchall()

            for row in rows:
                exported_ids.append(row["id"])
                category = row["category"] or "unknown"
                notes = row["notes"] or ""
                cards.append(Card(
                    front=f"{row['mistake']}\n\n[{category}]",
                    back=f"✓ {row['correction']}\n\n{notes}" if notes else f"✓ {row['correction']}",
                    tags=["polybridge", "mistake", category]
                ))

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid deck_type: {request.deck_type}. Must be 'false_friends', 'vocab', or 'mistakes'."
            )
        
        # Add cards to Anki
        logger.info(f"Fetched {len(cards)} unexported cards for deck_type: {request.deck_type}")
        if cards:
            add_request = AddCardsRequest(deck_name=deck_name, cards=cards)
            result = add_anki_cards(add_request)
            logger.info(f"Added {result['added']} cards to Anki deck: {deck_name}")

            # Mark only successfully added cards as exported
            if result["added"] > 0 and exported_ids:
                successful_indices = result.get("successful_indices", [])
                successfully_exported_ids = [exported_ids[i] for i in successful_indices if i < len(exported_ids)]

                if successfully_exported_ids:
                    with get_connection() as conn:
                        if request.deck_type in ["vocab", "false_friends"]:
                            placeholders = ", ".join("?" for _ in successfully_exported_ids)
                            conn.execute(
                                f"UPDATE vocab SET anki_exported = 1 WHERE id IN ({placeholders})",
                                tuple(successfully_exported_ids)
                            )
                        elif request.deck_type == "mistakes":
                            placeholders = ", ".join("?" for _ in successfully_exported_ids)
                            conn.execute(
                                f"UPDATE errors SET anki_exported = 1 WHERE id IN ({placeholders})",
                                tuple(successfully_exported_ids)
                            )
                    logger.info(f"Marked {len(successfully_exported_ids)} cards as exported")

            return {
                "added": result["added"],
                "deck": deck_name,
                "total": len(cards)
            }

        logger.info(f"No cards to export for deck_type: {request.deck_type}")
        return {"added": 0, "deck": deck_name, "total": 0}
    except Exception as e:
        logger.error(f"Error exporting deck: {e}")
        traceback.print_exc()  # prints full traceback to terminal
        raise HTTPException(status_code=500, detail=str(e))