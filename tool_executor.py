from server import (
    check_false_friend,
    end_session,
    generate_false_friends_for_profile,
    generate_report,
    get_error_patterns,
    get_multilingual_profile,
    get_profile,
    get_recent_errors,
    get_vocab_list,
    is_session_active,
    log_confirmed_false_friend,
    log_error,
    log_vocab_lookup,
    setup_profile,
    start_session,
)

_TOOL_HANDLERS = {
    "setup_profile": setup_profile,
    "get_profile": get_profile,
    "log_error": log_error,
    "get_recent_errors": get_recent_errors,
    "is_session_active": is_session_active,
    "start_session": start_session,
    "end_session": end_session,
    "get_error_patterns": get_error_patterns,
    "get_multilingual_profile": get_multilingual_profile,
    "generate_report": generate_report,
    "check_false_friend": check_false_friend,
    "log_confirmed_false_friend": log_confirmed_false_friend,
    "generate_false_friends_for_profile": generate_false_friends_for_profile,
    "log_vocab_lookup": log_vocab_lookup,
    "get_vocab_list": get_vocab_list,
}


def execute_tool(tool_name: str, tool_args: dict) -> str:
    """Run a tool by name with the given arguments and return its string result."""
    print(f"[tool] {tool_name}({tool_args})")

    handler = _TOOL_HANDLERS.get(tool_name)
    if handler is None:
        known = ", ".join(sorted(_TOOL_HANDLERS))
        return f"Error: unknown tool '{tool_name}'. Known tools: {known}."

    if tool_args is None:
        tool_args = {}

    try:
        result = handler(**tool_args)
        return result if isinstance(result, str) else str(result)
    except TypeError as exc:
        return f"Error calling {tool_name}: invalid arguments — {exc}"
    except Exception as exc:
        return f"Error calling {tool_name}: {exc}"
