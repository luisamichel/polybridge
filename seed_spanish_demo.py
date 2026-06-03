
import sqlite3
import os
from pathlib import Path
from datetime import datetime

# Direct path to your data folder matching your database.py logic
DB_PATH = Path(__file__).parent / "data" / "demo_spanish.db"

def seed_demo():
    # Ensure data folder exists
    DB_PATH.parent.mkdir(exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    
    # 1. Initialize the tables using your exact schema strings
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY,
            target_language TEXT NOT NULL,
            native_languages TEXT NOT NULL,
            proficiency TEXT DEFAULT 'beginner'
        );

        CREATE TABLE IF NOT EXISTS errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            mistake TEXT NOT NULL,
            correction TEXT NOT NULL,
            category TEXT,           
            interference_lang TEXT,  
            context TEXT,            
            notes TEXT,              
            anki_exported INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS vocab (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            translation TEXT,
            target_language TEXT,
            cognate_in TEXT,         
            is_false_friend INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'normal',
            first_seen TEXT,
            anki_exported INTEGER DEFAULT 0
        );
    """)
    
    # Clear out any existing entries to keep the demo clean
    conn.execute("DELETE FROM user_profile;")
    conn.execute("DELETE FROM errors;")
    conn.execute("DELETE FROM vocab;")
    
    # 2. Insert User Profile (Native: English & Portuguese | Target: Spanish)
    conn.execute("""
        INSERT INTO user_profile (id, target_language, native_languages, proficiency)
        VALUES (1, 'ES', '["EN", "PT"]', 'Intermediate');
    """)
    
    # 3. Insert existing historical errors to populate charts
    # Highlighting an English interference pattern ("embarazada") 
    # and a Portuguese structural interference pattern ("lo" instead of "el")
    now = datetime.now().isoformat()
    
    conn.execute("""
        INSERT INTO errors (timestamp, mistake, correction, category, interference_lang, context, notes, anki_exported)
        VALUES (?, 'embarazada', 'avergonzada', 'false_friend', 'English', 
        'Estoy muy embarazada por llegar tarde.', 
        'Learner used "embarazada" thinking it meant embarrassed. In Spanish, it means pregnant.', 0);
    """, (now,))

    conn.execute("""
        INSERT INTO errors (timestamp, mistake, correction, category, interference_lang, context, notes, anki_exported)
        VALUES (?, 'lo', 'el', 'grammar', 'Portuguese', 
        'Me gusta mucho lo carro rojo.', 
        'Portuguese speakers often use "lo" or "o" instinctively instead of the Spanish masculine article "el".', 0);
    """, (now,))
    
    # 4. Pre-populate the False Friend list with your active trap card
    conn.execute("""
        INSERT INTO vocab (word, translation, target_language, cognate_in, is_false_friend, priority, first_seen, anki_exported)
        VALUES ('embarazada', 'pregnant', 'Spanish', 'English', 1, 'high', ?, 1);
    """, (now,))
    
    conn.commit()
    conn.close()
    print(f"✓ Successfully created and seeded {DB_PATH} with your exact schema configuration!")

if __name__ == "__main__":
    seed_demo()