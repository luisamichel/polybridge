# false_friends.py
import json
import os
from pathlib import Path

FF_PATH = Path(__file__).parent / "data" / "false_friends.json"
_cache = None  # Module-level cache — load file once, reuse forever


def _load() -> list:
    """
    Load false friends from bundled JSON. 
    Uses module-level cache so file is only read once per server session.
    """
    global _cache
    if _cache is None:
        if not FF_PATH.exists():
            _cache = []
        else:
            with open(FF_PATH, encoding="utf-8") as f:
                _cache = json.load(f)
    return _cache


def _save(data: list):
    """Save updated false friends back to JSON and invalidate cache."""
    global _cache
    FF_PATH.parent.mkdir(exist_ok=True)
    with open(FF_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    _cache = data  # Update cache with new data


def get_for_profile(native_langs: list[str], target_lang: str) -> list:
    """Get all false friends relevant to this learner's profile."""
    return [
        ff for ff in _load()
        if ff["target_lang"] == target_lang
        and ff["native_lang"] in native_langs
    ]


def check_word(word: str, native_langs: list[str], target_lang: str) -> dict | None:
    """
    Check if a word is a false friend for this learner.
    Checks both the native word and target word columns.
    Returns the false friend dict or None.
    """
    word_lower = word.lower().strip()
    for ff in get_for_profile(native_langs, target_lang):
        if word_lower in (ff["target_word"].lower(), ff["native_word"].lower()):
            return ff
    return None


def get_summary(native_langs: list[str], target_lang: str) -> dict:
    """
    Count false friends per native language for a profile summary.
    Returns dict like {"EN": 25, "PT": 20}
    """
    relevant = get_for_profile(native_langs, target_lang)
    summary = {}
    for ff in relevant:
        lang = ff["native_lang"]
        summary[lang] = summary.get(lang, 0) + 1
    return summary


def has_coverage(native_langs: list[str], target_lang: str) -> bool:
    """
    Check if we have bundled data for this language combination.
    Used to decide whether to fall back to LLM generation.
    """
    return len(get_for_profile(native_langs, target_lang)) > 0


def add_from_llm(new_entries: list[dict]) -> int:
    """
    Add LLM-generated false friends to the dataset.
    Skips duplicates based on native_word + target_lang combination.
    Returns count of actually added entries.
    """
    existing = _load()
    
    # Build a set of existing pairs to avoid duplicates
    existing_pairs = {
        (ff["native_word"].lower(), ff["target_lang"], ff["native_lang"])
        for ff in existing
    }
    
    added = 0
    for entry in new_entries:
        pair = (
            entry["native_word"].lower(),
            entry["target_lang"],
            entry["native_lang"]
        )
        if pair not in existing_pairs:
            existing.append(entry)
            existing_pairs.add(pair)
            added += 1
    
    if added > 0:
        _save(existing)
    
    return added


# Quick test when run directly
if __name__ == "__main__":
    all_data = _load()
    print(f"✓ Loaded {len(all_data)} total false friends")
    
    # Test a known pair
    result = check_word("library", ["EN"], "FR")
    if result:
        print(f"✓ Detection works: 'library' → {result['target_actual_meaning']}")
    else:
        print("⚠️  Detection test failed — check your JSON data")
    
    # Show coverage summary
    print("\nCoverage summary:")
    pairs = set((ff["native_lang"], ff["target_lang"]) for ff in all_data)
    for native, target in sorted(pairs):
        count = len([ff for ff in all_data if ff["native_lang"] == native and ff["target_lang"] == target])
        print(f"  {native} → {target}: {count} entries")