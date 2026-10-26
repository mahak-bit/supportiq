"""Document ingestion service: extract → chunk → embed → persist → refresh index."""

from __future__ import annotations

import hashlib
import logging
from pathlib import PurePath

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import utcnow
from app.models import Chunk, KnowledgeDocument
from app.rag.chunking import chunk_pages
from app.rag.embeddings import get_embedder
from app.rag.extract import ExtractionError, detect_mime, extract_pages
from app.rag.index import vector_index

log = logging.getLogger("supportiq.ingest")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def title_from_filename(filename: str) -> str:
    stem = PurePath(filename).stem.replace("_", " ").replace("-", " ").strip()
    return stem[:1].upper() + stem[1:] if stem else "Untitled document"


def create_document(
    db: Session, filename: str, data: bytes, *, source: str = "upload", user_id: int | None = None
) -> KnowledgeDocument:
    """Validate and register a document. Raises ExtractionError for invalid input."""
    settings = get_settings()
    safe_name = PurePath(filename).name[:255] or "upload"
    if not data:
        raise ExtractionError("File is empty.")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise ExtractionError(f"File exceeds the {settings.max_upload_mb} MB limit.")
    mime = detect_mime(safe_name, data[:8192])
    doc = KnowledgeDocument(
        title=title_from_filename(safe_name),
        filename=safe_name,
        mime=mime,
        size_bytes=len(data),
        sha256=sha256(data),
        status="queued",
        source=source,
        uploaded_by=user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def process_document(db: Session, doc_id: int, data: bytes) -> KnowledgeDocument:
    """Run the full pipeline for one document. Failures are recorded on the document."""
    settings = get_settings()
    doc = db.get(KnowledgeDocument, doc_id)
    if doc is None:
        raise ValueError(f"document {doc_id} not found")
    doc.status, doc.error = "processing", ""
    db.commit()
    try:
        pages = extract_pages(data, doc.mime)
        # Markdown files: prefer the first H1 as the title.
        if doc.mime == "text/markdown":
            for line in pages[0].text.splitlines():
                if line.startswith("# "):
                    doc.title = line[2:].strip()[:200]
                    break
        pieces = chunk_pages(pages, settings.chunk_size, settings.chunk_overlap)
        if not pieces:
            raise ExtractionError("No usable text found in document.")
        embedder = get_embedder()
        vectors = embedder.embed_documents([f"{p.section}\n{p.text}" if p.section else p.text for p in pieces])
        doc.chunks.clear()
        db.flush()
        for i, (piece, vec) in enumerate(zip(pieces, vectors)):
            db.add(
                Chunk(
                    id=f"D{doc.id}-C{i + 1:03d}",
                    document_id=doc.id,
                    ordinal=i,
                    text=piece.text,
                    section=piece.section[:200],
                    page=piece.page,
                    embedding=vec.astype("float32").tobytes(),
                )
            )
        doc.chunk_count = len(pieces)
        doc.page_count = sum(1 for p in pages if p.page is not None)
        doc.embedding_model = embedder.name
        doc.status = "indexed"
        doc.indexed_at = utcnow()
        db.commit()
        log.info("indexed document id=%s chunks=%s", doc.id, len(pieces))
    except ExtractionError as exc:
        db.rollback()
        doc = db.get(KnowledgeDocument, doc_id)
        doc.status, doc.error = "failed", str(exc)
        db.commit()
    except Exception:  # noqa: BLE001 - record and surface any pipeline failure
        log.exception("ingestion failed for document id=%s", doc_id)
        db.rollback()
        doc = db.get(KnowledgeDocument, doc_id)
        doc.status, doc.error = "failed", "Processing failed unexpectedly. Check server logs and retry."
        db.commit()
    refresh_index(db)
    return doc


def refresh_index(db: Session) -> None:
    vector_index.rebuild(db, get_embedder().name)
