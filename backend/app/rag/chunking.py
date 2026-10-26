"""Structure-aware chunking: split on headings and paragraphs, then pack paragraphs into
windows of roughly `size` characters with `overlap` characters carried over."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.rag.extract import PageText

_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


@dataclass
class TextChunk:
    text: str
    section: str
    page: int | None


def _paragraphs(page: PageText):
    """Yield (section, paragraph) pairs, tracking the most recent markdown heading."""
    section = ""
    buf: list[str] = []
    for line in page.text.splitlines():
        m = _HEADING.match(line)
        if m:
            if buf:
                yield section, " ".join(buf).strip()
                buf = []
            section = m.group(2).strip()
            continue
        if not line.strip():
            if buf:
                yield section, " ".join(buf).strip()
                buf = []
            continue
        buf.append(line.strip())
    if buf:
        yield section, " ".join(buf).strip()


def _split_long(text: str, size: int) -> list[str]:
    if len(text) <= size:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out, cur = [], ""
    for s in sentences:
        while len(s) > size:  # pathological sentence with no punctuation
            out.append(s[:size])
            s = s[size:]
        if len(cur) + len(s) + 1 > size and cur:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def chunk_pages(pages: list[PageText], size: int = 900, overlap: int = 150) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    for page in pages:
        cur, cur_section = "", None
        for section, para in _paragraphs(page):
            if not para:
                continue
            # A new section starts a new chunk so citations stay topically clean.
            if cur and section != cur_section:
                chunks.append(TextChunk(cur, cur_section or "", page.page))
                cur = ""
            cur_section = section
            for piece in _split_long(para, size):
                if cur and len(cur) + len(piece) + 2 > size:
                    chunks.append(TextChunk(cur, section, page.page))
                    tail = cur[-overlap:]
                    tail = tail[tail.find(" ") + 1 :] if " " in tail else tail
                    cur = f"{tail}\n\n{piece}" if overlap else piece
                else:
                    cur = f"{cur}\n\n{piece}" if cur else piece
        if cur.strip():
            chunks.append(TextChunk(cur, cur_section or "", page.page))
    # Drop near-empty fragments (page numbers, stray headers).
    return [c for c in chunks if len(c.text.strip()) >= 40]
