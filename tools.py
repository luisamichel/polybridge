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

LOG_ERROR_CATEGORY_DESCRIPTION = """MUST be exactly one of these values, nothing else:
'grammar' - incorrect grammar structure
'vocab' - wrong word choice
'false_friend' - false cognate error
'gender' - wrong grammatical gender
'spelling' - spelling mistake
'word_order' - wrong word order
'unknown' - when unsure

NEVER put a sentence, explanation, or anything else here.
NEVER put the context sentence here.
If unsure, use 'unknown'."""

LOG_ERROR = {
    "type": "function",
    "function": {
        "name": "log_error",
        "description": (
            "Log a language error made during conversation or study.\n\n"
            "Call this immediately whenever the user makes a mistake. Mistakes that are "
            "likely typos shouldn't be logged.\n"
            "Always check get_profile() first to know which interference languages\n"
            "are relevant for this learner."
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
                    "description": LOG_ERROR_CATEGORY_DESCRIPTION,
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

START_SESSION = {
    "type": "function",
    "function": {
        "name": "start_session",
        "description": (
            "Start a language learning session. Call this at the beginning of\n"
            "any practice conversation or study session."
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

LOG_VOCAB_LOOKUP = {
    "type": "function",
    "function": {
        "name": "log_vocab_lookup",
        "description": (
            "Log a word the user asked about. Call this when the user asks\n"
            "what a word means, asks for a translation, or seems confused\n"
            "about a word you used. Do NOT call for words they already know."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "word": {
                    "type": "string",
                    "description": "The word in the target language",
                },
                "translation": {
                    "type": "string",
                    "description": (
                        "Meaning in the user's native language(s). "
                        "Include both EN and PT translations if relevant. "
                        'e.g. "siren / sireia (PT)"'
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
                        'e.g. "same root as English \'siren\', used for '
                        'mermaid in French (not just alarm)"'
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
            "Get the user's saved vocabulary words. Call when\n"
            "user asks to see their vocab list or review saved words."
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

TOOLS = [
    SETUP_PROFILE,
    GET_PROFILE,
    LOG_ERROR,
    GET_RECENT_ERRORS,
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
