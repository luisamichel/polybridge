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
# SESSION TOOLS
# ============================================================

@mcp.tool()
def start_session(topic: str = "general conversation") -> str:
    """
    Start a language learning session. Call this at the beginning of 
    any practice conversation or study session.
    
    Args:
        topic: what will be practiced — e.g. 'past tense', 
               'food vocabulary', 'general conversation'
    """
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (date, topic) VALUES (?, ?)",
            (datetime.now().isoformat(), topic)
        )
    
    # Get profile to personalize it
    with get_connection() as conn:
        profile = conn.execute(
            "SELECT * FROM user_profile LIMIT 1"
        ).fetchone()
    
    if profile:
        native_langs = json.loads(profile['native_languages'])
        return (
            f"Session started!\n"
            f"  Topic: {topic}\n"
            f"  Target language: {profile['target_language']}\n"
            f"  Watching for interference from: {', '.join(native_langs)}\n\n"
            f"I'll track your errors automatically. "
            f"Let's go!"
        )
    
    return f"Session started! Topic: {topic}. Set up your profile with setup_profile() for personalized tracking."


@mcp.tool()
def end_session(summary: str = "") -> str:
    """
    End the current learning session.
    Call this when the user finishes practicing.
    Provide a brief summary of what was covered.
    
    Args:
        summary: what was practiced and any notable observations
    """
    with get_connection() as conn:
        # Count errors logged in the last 3 hours (current session)
        recent_error_count = conn.execute("""
            SELECT COUNT(*) as count FROM errors
            WHERE timestamp > datetime('now', '-3 hours')
        """).fetchone()['count']
        
        # Update the most recent session
        conn.execute("""
            UPDATE sessions 
            SET summary = ?, errors_made = ?
            WHERE id = (SELECT MAX(id) FROM sessions)
        """, (summary, recent_error_count))
    
    return (
        f"Session ended!\n"
        f"  Errors logged: {recent_error_count}\n"
        f"  Summary: {summary or 'No summary provided'}\n\n"
        f"Use get_error_patterns() to see your trends, or "
        f"generate_report() for a full summary."
    )


# ============================================================
# PATTERN & INSIGHT TOOLS
# ============================================================

@mcp.tool()
def get_error_patterns() -> str:
    """
    Analyze all logged errors to surface recurring patterns and problem areas.
    
    Use this when the user asks:
    - What they struggle with
    - What to focus on
    - For a weekly review
    - Before starting a new session
    """
    with get_connection() as conn:
        # Overall count
        total = conn.execute(
            "SELECT COUNT(*) as count FROM errors"
        ).fetchone()['count']
        
        if total == 0:
            return "No errors logged yet. Start a session and practice — I'll track your mistakes automatically."
        
        # By category
        by_category = conn.execute("""
            SELECT category, COUNT(*) as count
            FROM errors
            GROUP BY category
            ORDER BY count DESC
        """).fetchall()
        
        # By interference language
        by_lang = conn.execute("""
            SELECT interference_lang, COUNT(*) as count
            FROM errors
            WHERE interference_lang != 'none'
            AND interference_lang != 'unknown'
            GROUP BY interference_lang
            ORDER BY count DESC
        """).fetchall()
        
        # Mistakes made more than once
        repeated = conn.execute("""
            SELECT mistake, correction, COUNT(*) as times
            FROM errors
            GROUP BY mistake
            HAVING times > 1
            ORDER BY times DESC
            LIMIT 5
        """).fetchall()
        
        # Most recent 3 errors for context
        recent = conn.execute("""
            SELECT mistake, correction, category
            FROM errors
            ORDER BY timestamp DESC
            LIMIT 3
        """).fetchall()
    
    lines = [f"=== ERROR PATTERNS ({total} total errors) ===\n"]
    
    lines.append("By error type:")
    for row in by_category:
        bar = "█" * row['count']
        lines.append(f"  {row['category']:<15} {bar} ({row['count']})")
    
    if by_lang:
        lines.append("\nBy source language interference:")
        for row in by_lang:
            bar = "█" * row['count']
            lines.append(f"  {row['interference_lang']:<15} {bar} ({row['count']})")
    
    if repeated:
        lines.append("\nMistakes you keep repeating:")
        for row in repeated:
            lines.append(f"  '{row['mistake']}' → '{row['correction']}' ({row['times']}x)")
    
    lines.append("\nMost recent errors:")
    for row in recent:
        lines.append(f"  [{row['category']}] '{row['mistake']}' → '{row['correction']}'")
    
    return "\n".join(lines)


@mcp.tool()
def get_multilingual_profile() -> str:
    """
    Show a breakdown of which native languages are interfering with
    the user's target language learning, and in what ways.
    
    Use this when the user wants to understand their specific challenges
    as a multilingual learner, or during weekly reviews.
    """
    with get_connection() as conn:
        profile = conn.execute(
            "SELECT * FROM user_profile LIMIT 1"
        ).fetchone()
        
        if not profile:
            return "No profile set up. Call setup_profile() first."
        
        native_langs = json.loads(profile['native_languages'])
        target = profile['target_language']
        
        # Build stats per native language
        lang_stats = {}
        for lang in native_langs:
            rows = conn.execute("""
                SELECT category, COUNT(*) as count
                FROM errors
                WHERE interference_lang = ?
                GROUP BY category
                ORDER BY count DESC
            """, (lang,)).fetchall()
            
            total = conn.execute("""
                SELECT COUNT(*) as count FROM errors
                WHERE interference_lang = ?
            """, (lang,)).fetchone()['count']
            
            lang_stats[lang] = {"total": total, "by_category": rows}
        
        # Errors with no interference
        clean = conn.execute("""
            SELECT COUNT(*) as count FROM errors
            WHERE interference_lang = 'none'
        """).fetchone()['count']
    
    lines = [f"=== YOUR MULTILINGUAL INTERFERENCE PROFILE ==="]
    lines.append(f"Learning: {target}")
    lines.append(f"Native languages: {', '.join(native_langs)}\n")
    
    for lang, stats in lang_stats.items():
        lines.append(f"{lang} interference: {stats['total']} errors")
        for row in stats['by_category']:
            lines.append(f"  {row['category']}: {row['count']}")
    
    if clean > 0:
        lines.append(f"\nErrors unrelated to native language interference: {clean}")
    
    # Insight based on data
    if lang_stats:
        most_interfering = max(lang_stats.items(), key=lambda x: x[1]['total'])
        if most_interfering[1]['total'] > 0:
            lines.append(
                f"\n💡 {most_interfering[0]} is currently your biggest source of interference. "
                f"This is normal — your strongest language creates the most habits to unlearn."
            )
    
    return "\n".join(lines)


@mcp.tool()
def generate_report(period: str = "all_time") -> str:
    """
    Generate a human-readable progress report summarizing errors,
    patterns, and sessions. 
    
    This report is designed to be readable by both the learner and 
    a tutor or teacher — it gives a clear picture of where the student
    is struggling and what they've been practicing.
    
    Args:
        period: 'all_time', 'this_week', or 'last_session'
    """
    with get_connection() as conn:
        profile = conn.execute(
            "SELECT * FROM user_profile LIMIT 1"
        ).fetchone()
        
        # Set time filter
        time_filter = {
            "this_week": "datetime('now', '-7 days')",
            "last_session": "datetime('now', '-3 hours')",
            "all_time": "datetime('2000-01-01')"
        }.get(period, "datetime('2000-01-01')")
        
        errors = conn.execute(f"""
            SELECT * FROM errors
            WHERE timestamp > {time_filter}
            ORDER BY timestamp DESC
        """).fetchall()
        
        sessions = conn.execute(f"""
            SELECT * FROM sessions
            WHERE date > {time_filter}
            ORDER BY date DESC
        """).fetchall()
    
    if not profile:
        return "No profile set up. Call setup_profile() first."
    
    native_langs = json.loads(profile['native_languages'])
    target = profile['target_language']
    
    # Build the report
    lines = [
        f"# PolyBridge Progress Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Period: {period.replace('_', ' ').title()}",
        f"",
        f"## Learner Profile",
        f"- Learning: {target}",
        f"- Native languages: {', '.join(native_langs)}",
        f"- Level: {profile['proficiency']}",
        f"",
        f"## Study Sessions",
        f"- Total sessions: {len(sessions)}",
    ]
    
    for s in sessions[:3]:  # Show last 3 sessions
        lines.append(f"  - {s['date'][:10]}: {s['topic']} ({s['errors_made']} errors)")
    
    lines += [
        f"",
        f"## Error Summary",
        f"- Total errors logged: {len(errors)}",
    ]
    
    if errors:
        # Group by category for report
        categories = {}
        for e in errors:
            cat = e['category'] or 'unknown'
            categories[cat] = categories.get(cat, 0) + 1
        
        lines.append("- Breakdown by type:")
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            lines.append(f"  - {cat}: {count}")
        
        lines += ["", "## Errors to Review"]
        for e in errors[:10]:  # Top 10 most recent
            lines.append(
                f"- [{e['category']} | {e['interference_lang']} interference] "
                f"'{e['mistake']}' → '{e['correction']}'"
            )
            if e['notes']:
                lines.append(f"  Note: {e['notes']}")
    
    # Save report to DB for future sharing
    report_content = "\n".join(lines)
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO reports (generated_at, period, content) VALUES (?, ?, ?)",
            (datetime.now().isoformat(), period, report_content)
        )
    
    return report_content


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    print("Starting PolyBridge MCP server...")
    mcp.run()