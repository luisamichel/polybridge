import json
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from database import init_db, get_connection

# Initialize DB and MCP server
init_db()
mcp = FastMCP("PolyBridge")


# ============================================================
# PROFILE TOOLS
# ============================================================

@mcp.tool()
def setup_profile(
    target_language: str,
    native_languages: list[str],
    proficiency: str = "beginner"
) -> str:
    """
    Set up the learner's language profile. This should be the first
    thing called when a new user starts using PolyBridge.

    Args:
        target_language: language being learned as a language code.
                         e.g. 'FR' (French), 'ES' (Spanish), 
                         'DE' (German), 'IT' (Italian)
        native_languages: list of languages the user already speaks fluently.
                          e.g. ["EN", "PT"] for English and Portuguese
        proficiency: current level at target language — 'beginner', 'intermediate', 'advanced'
    """
    with get_connection() as conn:
        # Delete existing profile and replace — only one profile at a time
        conn.execute("DELETE FROM user_profile")
        conn.execute(
            """INSERT INTO user_profile 
               (target_language, native_languages, proficiency)
               VALUES (?, ?, ?)""",
            (target_language, json.dumps(native_languages), proficiency)
        )
    
    return (
        f"✓ Profile set up!\n"
        f"  Learning: {target_language}\n"
        f"  Native languages: {', '.join(native_languages)}\n"
        f"  Level: {proficiency}\n\n"
        f"PolyBridge will now tailor everything to your background. "
        f"Try starting a conversation or logging an error."
    )


@mcp.tool()
def get_profile() -> str:
    """
    Get the current learner's language profile.
    Call this at the start of any session to remind yourself of the user's context.
    Always check the profile before logging errors or giving explanations.
    """
    with get_connection() as conn:
        profile = conn.execute(
            "SELECT * FROM user_profile LIMIT 1"
        ).fetchone()
    
    if not profile:
        return (
            "No profile set up yet. "
            "Please call setup_profile() first with your native languages "
            "and the language you're learning."
        )
    
    native_langs = json.loads(profile['native_languages'])
    
    return (
        f"Current profile:\n"
        f"  Learning: {profile['target_language']}\n"
        f"  Native languages: {', '.join(native_langs)}\n"
        f"  Level: {proficiency}\n"
    ).replace("proficiency", profile['proficiency'])


# ============================================================
# ERROR TRACKING TOOLS
# ============================================================

@mcp.tool()
def log_error(
    mistake: str,
    correction: str,
    context: str,
    category: str = "unknown",
    interference_lang: str = "unknown",
    notes: str = ""
) -> str:
    """
    Log a language error made during conversation or study.

    Call this immediately whenever the user makes a mistake.
    Always check get_profile() first to know which interference languages
    are relevant for this learner.

    Args:
        mistake: exactly what the user said or wrote incorrectly
        correction: the correct form
        context: the full sentence where the error occurred
        category: type of error — 'grammar', 'vocab', 'false_friend',
                  'gender', 'spelling', 'word_order'
        interference_lang: which native language likely caused this error.
                           Use the language code from their profile (e.g. 'EN', 'PT')
                           or 'none' if unrelated to native language interference
        notes: brief explanation of why this is wrong and how to remember the fix
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO errors
               (timestamp, mistake, correction, category, interference_lang, context, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (datetime.now().isoformat(), mistake, correction,
             context, category, interference_lang, notes)
        )
        error_id = cursor.lastrowid

    return (
        f"✓ Error logged (#{error_id})\n"
        f"  ✗ {mistake}\n"
        f"  ✓ {correction}\n"
        f"  Category: {category} | Interference: {interference_lang}\n"
        f"  Note: {notes}"
    )


@mcp.tool()
def get_recent_errors(limit: int = 10) -> str:
    """
    Get the most recent errors logged.
    Use this to review recent mistakes or before starting a new session
    to remind the user what they struggled with last time.
    """
    with get_connection() as conn:
        errors = conn.execute(
            "SELECT * FROM errors ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        ).fetchall()

    if not errors:
        return (
            "No errors logged yet. Start practicing and I'll track "
            "your mistakes automatically."
        )

    lines = [f"Your last {len(errors)} errors:\n"]
    for e in errors:
        lines.append(
            f"[{e['category']} | {e['interference_lang']} interference]\n"
            f"  ✗ {e['mistake']} → ✓ {e['correction']}\n"
            f"  Context: {e['context']}\n"
        )

    return "\n".join(lines)


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("Starting PolyBridge MCP server...")
    mcp.run()