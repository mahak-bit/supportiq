from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import engine, get_db
from app.llm.providers import get_llm, ollama_reachable
from app.models import Chunk, KnowledgeDocument, Ticket, User
from app.rag.embeddings import get_embedder
from app.rag.index import vector_index
from app.rag.retriever import min_score
from app.security import current_user

router = APIRouter(prefix="/api", tags=["system"])


def _storage(dialect: str, url: str) -> dict:
    if dialect != "sqlite":
        return {"dialect": dialect, "persistent": True, "note": "External database via DATABASE_URL."}
    if ":memory:" in url or "/tmp/" in url:
        # Serverless hosts (e.g. Vercel) only offer temporary disk: data resets on cold starts.
        return {"dialect": dialect, "persistent": False,
                "note": "SQLite in temporary storage: the demo resets to its seeded state when the server restarts."}
    return {"dialect": dialect, "persistent": True, "note": "SQLite file on local disk."}


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    """Configuration report for the Settings page. Reports whether secrets are present,
    never their values."""
    s = get_settings()
    llm = get_llm()
    dialect = engine.dialect.name
    return {
        "workspace": {"company_name": s.company_name, "environment": s.environment},
        "llm": {
            "active_provider": llm.name,
            "active_model": llm.model,
            "is_llm": llm.is_llm,
            "configured_provider": s.llm_provider,
            "gemini_key_present": bool(s.gemini_api_key),
            "gemini_model": s.gemini_model,
            "ollama_reachable": ollama_reachable(),
            "ollama_model": s.ollama_model,
            "timeout_seconds": s.llm_timeout_seconds,
            "max_retries": s.llm_max_retries,
        },
        "retrieval": {
            "embedding": get_embedder().name,
            "index_backend": vector_index.backend,
            "indexed_chunks": vector_index.size,
            "top_k": s.retrieval_top_k,
            "min_score": min_score(),
            "chunk_size": s.chunk_size,
            "chunk_overlap": s.chunk_overlap,
        },
        "storage": _storage(dialect, s.database_url),
        "limits": {"max_upload_mb": s.max_upload_mb, "ai_requests_per_minute": s.ai_rate_limit_per_minute,
                   "refund_lead_approval_threshold": s.refund_lead_approval_threshold_cents / 100},
        "counts": {
            "documents": db.scalar(select(func.count(KnowledgeDocument.id))),
            "chunks": db.scalar(select(func.count(Chunk.id))),
            "tickets": db.scalar(select(func.count(Ticket.id))),
        },
    }
