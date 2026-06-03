"""OpenAI function-calling tool definitions for PolyBridge."""

LOG_ERROR_CATEGORIES = (
    "grammar",
    "vocab",
    "false_friend",
    "gender",
    "spelling",
    "word_order",
    "unknown",
)

INTERFERENCE_LANGS = (
    "EN",
    "PT",
    "ES",
    "FR",
    "DE",
    "IT",
    "JA",
    "ZH",
    "KO",
    "RU",
    "AR",
    "none",
    "unknown",
)

REPORT_PERIODS = ("all_time", "this_week", "last_session")

FALSE_FRIEND_DANGER_LEVELS = ("high", "medium")

PROFICIENCY_LEVELS = ("beginner", "intermediate", "advanced")

LOG_ERROR = {
    "type": "function",
    "function": {
        "name": "log_error",
        "description": (
            "Log a language error made during conversation or study.\n\n"
            "Call this immediately whenever the user makes a mistake. Mistakes that are "
            "likely typos shouldn't be logged.\n"
            "Always check get_profile() first to remind yourself of the interference languages\n"
            "that are relevant for this learner."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "mistake": {
                    "type": "string",
                    "description": "Exactly what the user said or wrote incorrectly",
                },
                "correction": {
                    "type": "string",
                    "description": "The correct form",
                },
                "context": {
                    "type": "string",
                    "description": "The full sentence where the error occurred",
                },
                "category": {
                    "type": "string",
                    "enum": list(LOG_ERROR_CATEGORIES),
                    "description": (
                        "Type of error — one of: 'grammar', 'vocab', 'false_friend', "
                        "'gender', 'spelling', 'word_order'"
                    ),
                },
                "interference_lang": {
                    "type": "string",
                    "enum": list(INTERFERENCE_LANGS),
                    "description": (
                        "Which native language likely caused this error. "
                        "Use the language code from their profile (e.g. 'EN', 'PT') "
                        "or 'none' if unrelated to native language interference"
                    ),
                },
                "notes": {
                    "type": "string",
                    "description": (
                        "Brief explanation of why this is wrong and how to remember the fix"
                    ),
                },
            },
            "required": [
                "mistake",
                "correction",
                "context",
                "category",
                "interference_lang",
                "notes",
            ],
            "additionalProperties": False,
        },
    },
}

CHECK_FALSE_FRIEND = {
    "type": "function",
    "function": {
        "name": "check_false_friend",
        "description": (
            "Check if a word is a false friend for this learner based on\n"
            "their native languages and target language.\n\n"
            "Call this proactively when:\n"
            "- A word appears that looks similar to a word in the user's native language\n"
            "- The user uses a word that might have a different meaning than they think\n"
            "- Introducing new vocabulary that has cognates in native languages\n\n"
            "Checks curated dataset first, then falls back to your own linguistic\n"
            "knowledge for pairs not in the dataset."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "word": {
                    "type": "string",
                    "description": (
                        "The word to check — can be in either native or target language"
                    ),
                },
            },
            "required": ["word"],
            "additionalProperties": False,
        },
    },
}

GET_ERROR_PATTERNS = {
    "type": "function",
    "function": {
        "name": "get_error_patterns",
        "description": (
            "Analyze all logged errors to surface recurring patterns and problem areas.\n\n"
            "Use this when the user asks:\n"
            "- What they struggle with\n"
            "- What to focus on\n"
            "- For a weekly review\n"
            "- Before starting a new session"
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

IS_SESSION_ACTIVE = {
    "type": "function",
    "function": {
        "name": "is_session_active",
        "description": (
            "Check whether a learning session is currently active.\n\n"
            "Returns true if a session has been started and not yet ended.\n"
            "Use this to avoid starting a new session while one is already active."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

START_SESSION = {
    "type": "function",
    "function": {
        "name": "start_session",
        "description": (
            "Start a language learning session. Call this at the beginning of "
            "a practice or study session only. Do not recall it while a session "
            "is active, even if the user changes the topic of the conversation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": (
                        "What will be practiced — e.g. 'past tense', "
                        "'food vocabulary', 'general conversation'"
                    ),
                },
                "focus_grammar": {
                    "type": "string",
                    "description": (
                        "Optional grammar point to emphasize during the conversation "
                        "(e.g. 'subjunctive', 'preterite vs imperfect')"
                    ),
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

SETUP_PROFILE = {
    "type": "function",
    "function": {
        "name": "setup_profile",
        "description": (
            "Set up the learner's language profile.\n\n"
            "Call this when the user tells you their native language(s) and\n"
            "what language they want to learn.\n\n"
            "After calling this, STOP and wait for the user's next instruction.\n"
            "Do NOT automatically start a session."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target_language": {
                    "type": "string",
                    "description": (
                        "Language being learned as a language code. "
                        "e.g. 'FR' (French), 'ES' (Spanish), "
                        "'DE' (German), 'IT' (Italian)"
                    ),
                },
                "native_languages": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Languages the user already speaks fluently. "
                        'e.g. ["EN", "PT"] for English and Portuguese'
                    ),
                },
                "proficiency": {
                    "type": "string",
                    "enum": list(PROFICIENCY_LEVELS),
                    "description": (
                        "Current level at target language — "
                        "'beginner', 'intermediate', 'advanced'"
                    ),
                },
            },
            "required": ["target_language", "native_languages"],
            "additionalProperties": False,
        },
    },
}

GET_PROFILE = {
    "type": "function",
    "function": {
        "name": "get_profile",
        "description": (
            "Get the current learner's language profile.\n"
            "Call this at the start of any session to remind yourself of the user's context.\n"
            "Always check the profile before logging errors or giving explanations."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

GET_RECENT_ERRORS = {
    "type": "function",
    "function": {
        "name": "get_recent_errors",
        "description": (
            "Get the most recent errors logged.\n"
            "Use this to review recent mistakes or before starting a new session\n"
            "to remind the user what they struggled with last time."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of recent errors to return (default 10)",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

END_SESSION = {
    "type": "function",
    "function": {
        "name": "end_session",
        "description": (
            "End the current learning session.\n"
            "Call this when the user finishes practicing.\n"
            "Provide a brief summary of what was covered."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "What was practiced and any notable observations",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

GET_MULTILINGUAL_PROFILE = {
    "type": "function",
    "function": {
        "name": "get_multilingual_profile",
        "description": (
            "Show a breakdown of which native languages are interfering with\n"
            "the user's target language learning, and in what ways.\n\n"
            "Use this when the user wants to understand their specific challenges\n"
            "as a multilingual learner, or during weekly reviews."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

GENERATE_REPORT = {
    "type": "function",
    "function": {
        "name": "generate_report",
        "description": (
            "Generate a human-readable progress report summarizing errors,\n"
            "patterns, and sessions. \n\n"
            "This report is designed to be readable by both the learner and \n"
            "a tutor or teacher — it gives a clear picture of where the student\n"
            "is struggling and what they've been practicing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": list(REPORT_PERIODS),
                    "description": "'all_time', 'this_week', or 'last_session'",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

LOG_CONFIRMED_FALSE_FRIEND = {
    "type": "function",
    "function": {
        "name": "log_confirmed_false_friend",
        "description": (
            "Permanently add a false friend to the dataset.\n\n"
            "ONLY call this when ALL of these are true:\n"
            "1. check_false_friend() returned \"not found\" for this word\n"
            "2. You have verified through linguistic knowledge this IS a false friend\n"
            "3. The words look or sound similar AND mean something different\n\n"
            "Do NOT call this just because a user made a false friend error —\n"
            "check_false_friend() handles detection. This is only for ADDING\n"
            "NEW entries that are missing from the dataset."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "native_lang": {
                    "type": "string",
                    "description": "Learner's native language code e.g. 'EN', 'PT'",
                },
                "target_lang": {
                    "type": "string",
                    "description": "Language being learned e.g. 'FR', 'DE'",
                },
                "native_word": {
                    "type": "string",
                    "description": "The word in the native language",
                },
                "target_word": {
                    "type": "string",
                    "description": "The similar word in the target language",
                },
                "target_actual_meaning": {
                    "type": "string",
                    "description": "What target_word ACTUALLY means",
                },
                "native_assumed_meaning": {
                    "type": "string",
                    "description": "What the learner INCORRECTLY thinks it means",
                },
                "danger": {
                    "type": "string",
                    "enum": list(FALSE_FRIEND_DANGER_LEVELS),
                    "description": (
                        "'high' = completely different meaning, "
                        "'medium' = partially overlapping meaning"
                    ),
                },
            },
            "required": [
                "native_lang",
                "target_lang",
                "native_word",
                "target_word",
                "target_actual_meaning",
                "native_assumed_meaning",
            ],
            "additionalProperties": False,
        },
    },
}

LOG_VOCAB_LOOKUP = {
    "type": "function",
    "function": {
        "name": "log_vocab_lookup",
        "description": (
            "Log a word that the user asked about during conversation.\n\n"
            "Call this immediately when:\n"
            "- The user asks \"what does X mean?\"\n"
            "- The user asks \"what is X?\"\n"
            "- The user asks for a translation of a specific word\n"
            "- The user seems confused about a word you used and you explain it\n"
            "- The user explicitly asks to save or remember a word\n\n"
            "Do NOT call this for:\n"
            "- Words the user already clearly knows\n"
            "- Words you mention in passing without the user asking\n"
            "- Error corrections (use log_error for those)"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "word": {
                    "type": "string",
                    "description": "The word in the target language exactly as it appeared",
                },
                "translation": {
                    "type": "string",
                    "description": (
                        "The meaning in the user's native language(s). "
                        "Include both EN and PT translations if relevant. "
                        "e.g. \"siren / sireia (PT)\""
                    ),
                },
                "example_sentence": {
                    "type": "string",
                    "description": (
                        "The sentence where this word appeared, "
                        "or a good example sentence using the word"
                    ),
                },
                "notes": {
                    "type": "string",
                    "description": (
                        "Any helpful memory tip, etymology, or usage note. "
                        "e.g. \"same root as English 'siren', used for mermaid in French (not just alarm)\""
                    ),
                },
            },
            "required": ["word", "translation"],
            "additionalProperties": False,
        },
    },
}

GET_VOCAB_LIST = {
    "type": "function",
    "function": {
        "name": "get_vocab_list",
        "description": (
            "Get the user's saved vocabulary words.\n"
            "Use this when the user asks to review their vocab list "
            "or wants to see words they have looked up."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of words to return (default 20)",
                },
            },
            "required": [],
            "additionalProperties": False,
        },
    },
}

GENERATE_FALSE_FRIENDS_FOR_PROFILE = {
    "type": "function",
    "function": {
        "name": "generate_false_friends_for_profile",
        "description": (
            "Generate false friends data for the current profile's language pair\n"
            "using AI knowledge when bundled data doesn't cover it.\n\n"
            "Call this automatically after setup_profile() if has_bundled_coverage()\n"
            "returns False. This ensures every learner gets false friend detection\n"
            "regardless of their language combination.\n\n"
            "Returns instructions for generating and adding the data."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

TOOLS = [
    SETUP_PROFILE,
    GET_PROFILE,
    LOG_ERROR,
    GET_RECENT_ERRORS,
    IS_SESSION_ACTIVE,
    START_SESSION,
    END_SESSION,
    GET_ERROR_PATTERNS,
    GET_MULTILINGUAL_PROFILE,
    GENERATE_REPORT,
    CHECK_FALSE_FRIEND,
    LOG_CONFIRMED_FALSE_FRIEND,
    GENERATE_FALSE_FRIENDS_FOR_PROFILE,
    LOG_VOCAB_LOOKUP,
    GET_VOCAB_LIST,
]

TOOL_NAMES = {tool["function"]["name"] for tool in TOOLS}
