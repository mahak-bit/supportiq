"""Test configuration. Runs fully offline: a temporary SQLite database, the deterministic
lexical embedder and the extractive (no-LLM) provider. LLM-path behaviour is tested with a
scripted fake provider so validation logic is exercised without network calls."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="supportiq-test-"))
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite:///{(_tmp / 'test.db').as_posix()}",
        "DATA_DIR": str(_tmp),
        "EMBEDDING_PROVIDER": "hashing",
        "LLM_PROVIDER": "extractive",
        "GEMINI_API_KEY": "",
        "JWT_SECRET": "test-secret-not-for-production-use-0123456789",
        "AI_RATE_LIMIT_PER_MINUTE": "1000",
        "LOGIN_RATE_LIMIT_PER_MINUTE": "1000",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.security import limiter  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(c: TestClient, who: str = "agent") -> TestClient:
    r = c.post("/api/auth/login", json={"email": f"{who}@supportiq.demo", "password": "demo-password"})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture
def agent(client):
    limiter.reset()
    return login(client, "agent")


@pytest.fixture
def lead(client):
    limiter.reset()
    return login(client, "lead")


def ticket_by_subject(c: TestClient, subject: str) -> dict:
    items = c.get("/api/tickets", params={"status": "all", "q": subject}).json()["items"]
    match = [t for t in items if t["subject"] == subject]
    assert match, f"seed ticket '{subject}' missing"
    return match[0]
