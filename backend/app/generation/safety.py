"""Defences for treating customer text and documents as untrusted data."""

from __future__ import annotations

import re

# Phrases typical of attempts to steer the model. Detection is a signal for the human
# reviewer (and an escalation trigger), not a substitute for the structural defences:
# delimiting untrusted text, a fixed system prompt, schema-constrained output and the
# fact that the model has no tools that move money or send messages.
_INJECTION_PATTERNS = [
    r"ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|messages)",
    r"disregard (the |your )?(system|previous|prior) (prompt|instructions)",
    r"you are now (a|an|in) ",
    r"system prompt",
    r"developer mode",
    r"(act|pretend) as (if you are |an? )?(admin|administrator|developer|supervisor)",
    r"(approve|issue|process) (a |the |my )?(full )?refund (immediately|now|without)",
    r"<\s*/?\s*(system|evidence|customer_message|instructions)\s*>",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)
_TAG_RE = re.compile(r"<\s*/?\s*(system|evidence|customer_message|order_facts|eligibility|instructions)[^>]*>", re.I)


def detect_injection(text: str) -> list[str]:
    return sorted({m.group(0).strip()[:80] for m in _INJECTION_RE.finditer(text or "")})


def fence(text: str, limit: int = 6000) -> str:
    """Neutralise our own delimiter tags inside untrusted text so it cannot close a fence."""
    return _TAG_RE.sub("[removed-tag]", (text or "")[:limit])
