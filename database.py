import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "data" / "polyglot.db"

def get_connection():
    """Always use this to get a DB connection — never connect directly."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns dict-like rows instead of tuples
    return conn

def init_db():
    """Create all tables if they don't exist. Safe to call multiple times."""
    # Make sure data/ folder exists
    DB_PATH.parent.mkdir(exist_ok=True)
    
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY,
                target_language TEXT NOT NULL,
                native_languages TEXT NOT NULL,  -- stored as JSON: '["EN", "PT"]'
                proficiency TEXT DEFAULT 'beginner'
            );

            CREATE TABLE IF NOT EXISTS errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                mistake TEXT NOT NULL,
                correction TEXT NOT NULL,
                category TEXT,           -- 'grammar', 'vocab', 'false_friend', 'gender', 'spelling'
                interference_lang TEXT,  -- which native language caused this (could be none)
                context TEXT,            -- full sentence where error occurred
                notes TEXT               -- explanation of why it's wrong
            );

            CREATE TABLE IF NOT EXISTS vocab (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                translation TEXT,
                target_language TEXT,
                cognate_in TEXT,         -- which native language has a cognate (could be none)
                is_false_friend INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'normal',
                first_seen TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                topic TEXT,
                summary TEXT,
                errors_made INTEGER DEFAULT 0
            );
                           
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                generated_at TEXT NOT NULL,
                period TEXT,           -- 'weekly', 'session', 'all_time'
                content TEXT,          -- human-readable markdown report
                shared INTEGER DEFAULT 0  -- flag for future sharing feature
            );
        """)

if __name__ == "__main__":
    init_db()
    print("✓ Database initialized successfully")
    print(f"✓ DB location: {DB_PATH}")