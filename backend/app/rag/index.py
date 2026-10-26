"""Vector index. The source of truth is the `chunks` table (embeddings stored as float32
bytes); FAISS is an in-memory accelerator rebuilt from the database, so the index can
never drift from persisted data across restarts."""

from __future__ import annotations

import threading
from dataclasses import dataclass

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Chunk, KnowledgeDocument

try:  # FAISS is preferred; fall back to exact NumPy search if the wheel is unavailable.
    import faiss  # type: ignore

    HAS_FAISS = True
except Exception:  # pragma: no cover
    HAS_FAISS = False


@dataclass
class Hit:
    chunk_id: str
    score: float


class VectorIndex:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._ids: list[str] = []
        self._matrix: np.ndarray | None = None
        self._faiss = None
        self.dim: int | None = None
        self.model_name: str = ""

    @property
    def backend(self) -> str:
        return "faiss-cpu (IndexFlatIP)" if HAS_FAISS else "numpy (exact cosine)"

    @property
    def size(self) -> int:
        return len(self._ids)

    def rebuild(self, db: Session, model_name: str) -> None:
        rows = db.execute(
            select(Chunk.id, Chunk.embedding)
            .join(KnowledgeDocument)
            .where(KnowledgeDocument.status == "indexed", KnowledgeDocument.embedding_model == model_name)
        ).all()
        ids = [r[0] for r in rows if r[1]]
        vecs = [np.frombuffer(r[1], dtype=np.float32) for r in rows if r[1]]
        with self._lock:
            self.model_name = model_name
            self._ids = ids
            if not vecs:
                self._matrix, self._faiss, self.dim = None, None, None
                return
            m = np.ascontiguousarray(np.stack(vecs).astype(np.float32))
            self._matrix, self.dim = m, m.shape[1]
            if HAS_FAISS:
                idx = faiss.IndexFlatIP(self.dim)
                idx.add(m)
                self._faiss = idx

    def search(self, query: np.ndarray, k: int) -> list[Hit]:
        with self._lock:
            if self._matrix is None or not self._ids:
                return []
            k = min(k, len(self._ids))
            q = np.ascontiguousarray(query.reshape(1, -1).astype(np.float32))
            if self._faiss is not None:
                scores, idxs = self._faiss.search(q, k)
                pairs = zip(idxs[0].tolist(), scores[0].tolist())
            else:
                sims = (self._matrix @ q[0])
                top = np.argsort(-sims)[:k]
                pairs = ((int(i), float(sims[i])) for i in top)
            return [Hit(self._ids[i], float(s)) for i, s in pairs if i >= 0]


vector_index = VectorIndex()
