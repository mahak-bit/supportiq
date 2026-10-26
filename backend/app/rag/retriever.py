from __future__ import annotations

from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models import Chunk
from app.rag.embeddings import get_embedder
from app.rag.index import vector_index


@dataclass
class Passage:
    chunk_id: str
    document_id: int
    document_title: str
    section: str
    page: int | None
    text: str
    score: float

    def to_dict(self) -> dict:
        return asdict(self)


def min_score() -> float:
    s = get_settings()
    return s.retrieval_min_score if s.retrieval_min_score is not None else get_embedder().default_min_score


def retrieve(db: Session, query: str, k: int | None = None, *, apply_threshold: bool = True) -> list[Passage]:
    """Semantic search over indexed chunks. With apply_threshold, weak matches are dropped
    so that downstream generation sees "no evidence" rather than irrelevant text."""
    k = k or get_settings().retrieval_top_k
    query = query.strip()[:2000]
    if not query:
        return []
    hits = vector_index.search(get_embedder().embed_query(query), k)
    if apply_threshold:
        floor = min_score()
        hits = [h for h in hits if h.score >= floor]
    if not hits:
        return []
    rows = db.scalars(select(Chunk).options(joinedload(Chunk.document)).where(Chunk.id.in_([h.chunk_id for h in hits])))
    by_id = {c.id: c for c in rows}
    out = []
    for h in hits:
        c = by_id.get(h.chunk_id)
        if c is None:
            continue
        out.append(Passage(c.id, c.document_id, c.document.title, c.section, c.page, c.text, round(h.score, 4)))
    return out
