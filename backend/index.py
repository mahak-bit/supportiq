"""Entrypoint for platforms that look for a top-level ASGI `app` (e.g. Vercel's FastAPI preset)."""

from app.main import app

__all__ = ["app"]
