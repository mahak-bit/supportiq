"""Text extraction for supported knowledge formats. Output keeps page numbers so citations
can point back to the exact place in the source."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePath

SUPPORTED_EXTENSIONS = {".pdf": "application/pdf", ".md": "text/markdown", ".txt": "text/plain"}


class ExtractionError(ValueError):
    pass


@dataclass
class PageText:
    page: int | None
    text: str


def detect_mime(filename: str, head: bytes) -> str:
    ext = PurePath(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ExtractionError(f"Unsupported file type '{ext or 'none'}'. Upload PDF, Markdown or plain text.")
    mime = SUPPORTED_EXTENSIONS[ext]
    # Validate content, not just the extension.
    if mime == "application/pdf" and not head.startswith(b"%PDF"):
        raise ExtractionError("File has a .pdf extension but is not a valid PDF.")
    if mime != "application/pdf" and b"\x00" in head[:4096]:
        raise ExtractionError("Text file appears to contain binary data.")
    return mime


def extract_pages(data: bytes, mime: str) -> list[PageText]:
    if mime == "application/pdf":
        return _extract_pdf(data)
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    return [PageText(page=None, text=text)]


def _extract_pdf(data: bytes) -> list[PageText]:
    import pymupdf  # imported lazily: heavy native module

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - library raises several types
        raise ExtractionError("Could not open PDF (it may be corrupted).") from exc
    if doc.needs_pass:
        raise ExtractionError("PDF is password-protected.")
    pages = [PageText(page=i + 1, text=page.get_text("text")) for i, page in enumerate(doc)]
    doc.close()
    if not any(p.text.strip() for p in pages):
        raise ExtractionError("PDF has no extractable text (scanned images need OCR, which is not enabled).")
    return pages
