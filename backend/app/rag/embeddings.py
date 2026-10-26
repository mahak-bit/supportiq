"""Embedding providers. All return L2-normalised float32 vectors so inner product == cosine."""

from __future__ import annotations

import hashlib
import re
import threading
from functools import lru_cache
from typing import Protocol

import numpy as np

from app.config import get_settings


class Embedder(Protocol):
    name: str
    dim: int
    default_min_score: float

    def embed_documents(self, texts: list[str]) -> np.ndarray: ...

    def embed_query(self, text: str) -> np.ndarray: ...


def _normalise(m: np.ndarray) -> np.ndarray:
    m = np.asarray(m, dtype=np.float32)
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


class FastEmbedEmbedder:
    """Local ONNX embeddings (no PyTorch). Model weights download once on first use."""

    default_min_score = 0.62

    def __init__(self, model: str):
        from fastembed import TextEmbedding

        self.name = f"fastembed:{model}"
        self._model = TextEmbedding(model_name=model, cache_dir=str(get_settings().data_dir / "models"))
        self._lock = threading.Lock()
        self.dim = int(self.embed_query("probe").shape[0])

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        with self._lock:
            return _normalise(np.array(list(self._model.passage_embed(texts))))

    def embed_query(self, text: str) -> np.ndarray:
        with self._lock:
            return _normalise(np.array(list(self._model.query_embed(text))))[0]


class SentenceTransformerEmbedder:
    """Optional: requires `pip install sentence-transformers` (pulls in PyTorch)."""

    default_min_score = 0.45

    def __init__(self, model: str):
        from sentence_transformers import SentenceTransformer

        self.name = f"sentence-transformers:{model}"
        self._model = SentenceTransformer(model)
        self.dim = int(self._model.get_sentence_embedding_dimension())

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return _normalise(self._model.encode(texts, normalize_embeddings=True))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalise(self._model.encode([text], normalize_embeddings=True))[0]


_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = set("a an the and or of to in on for is are be with my i me you your it this that was at as by".split())


class HashingEmbedder:
    """Deterministic lexical feature-hashing (unigrams + bigrams). Not semantic. Used for
    offline tests and as an explicit fallback; the UI labels it as lexical-only."""

    default_min_score = 0.12

    def __init__(self, dim: int = 1024):
        self.name = "hashing:lexical-1024"
        self.dim = dim

    def _vec(self, text: str) -> np.ndarray:
        toks = [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]
        feats = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
        v = np.zeros(self.dim, dtype=np.float32)
        for f in feats:
            h = int.from_bytes(hashlib.blake2b(f.encode(), digest_size=8).digest(), "little")
            v[h % self.dim] += 1.0 if (h >> 63) == 0 else -1.0
        return v

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return _normalise(np.stack([self._vec(t) for t in texts]) if texts else np.zeros((0, self.dim)))

    def embed_query(self, text: str) -> np.ndarray:
        return _normalise(self._vec(text)[None, :])[0]


@lru_cache
def get_embedder() -> Embedder:
    s = get_settings()
    if s.embedding_provider == "hashing":
        return HashingEmbedder()
    if s.embedding_provider == "sentence-transformers":
        return SentenceTransformerEmbedder(s.embedding_model)
    return FastEmbedEmbedder(s.embedding_model)
