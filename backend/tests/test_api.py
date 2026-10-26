"""API-level tests: auth, tickets, knowledge ingestion + grounded Q&A, analytics."""

from __future__ import annotations

from pathlib import Path

from app.config import get_settings
from tests.conftest import login, ticket_by_subject

SAMPLE = Path(__file__).resolve().parents[2] / "sample-docs" / "gift-services.md"


def test_requires_authentication(client):
    client.cookies.clear()
    assert client.get("/api/tickets").status_code == 401
    assert client.post("/api/auth/login", json={"email": "agent@supportiq.demo", "password": "nope"}).status_code == 401
    assert client.get("/api/health").json() == {"status": "ok"}


def test_ticket_list_search_and_filters(agent):
    data = agent.get("/api/tickets").json()
    assert data["counts"]["all"] == 58 and data["total"] == data["counts"]["active"] >= 1
    assert all(t["is_synthetic"] for t in data["items"])
    assert [t["priority"] for t in data["items"]][:1] == ["high"]  # priority sort
    hits = agent.get("/api/tickets", params={"q": "HC-10433"}).json()["items"]
    assert [t["subject"] for t in hits] == ["Plates arrived cracked"]
    low = agent.get("/api/tickets", params={"priority": "low"}).json()["items"]
    assert low and all(t["priority"] == "low" for t in low)
    assert agent.get("/api/tickets", params={"status": "bogus"}).status_code == 422


def test_ticket_detail_notes_and_status(agent):
    t = ticket_by_subject(agent, "Which bulb for the Lumen lamp?")
    d = agent.get(f"/api/tickets/{t['id']}").json()
    assert d["customer_profile"]["name"] == "Lucas Moreau" and d["messages"][0]["author_type"] == "customer"
    note = agent.post(f"/api/tickets/{t['id']}/notes", json={"body": "Checked the FAQ."}).json()
    assert note["is_internal"] is True
    assert agent.post(f"/api/tickets/{t['id']}/notes", json={"body": ""}).status_code == 422


def test_upload_validation(agent):
    r = agent.post("/api/knowledge/documents", files={"file": ("x.exe", b"MZ...", "application/octet-stream")})
    assert r.status_code == 422
    r = agent.post("/api/knowledge/documents", files={"file": ("fake.pdf", b"hello", "application/pdf")})
    assert r.status_code == 422 and "not a valid PDF" in r.json()["detail"]
    s = get_settings()
    old, s.max_upload_mb = s.max_upload_mb, 1
    try:
        r = agent.post("/api/knowledge/documents", files={"file": ("big.txt", b"a" * (1024 * 1024 + 10), "text/plain")})
        assert r.status_code == 413
    finally:
        s.max_upload_mb = old


def test_genai_proof_upload_then_cited_answer(agent):
    """Before upload the KB can't answer an engraving question; after uploading the
    gift-services document the answer cites a passage from that document."""
    q = {"question": "Can the Kestrel carafe be engraved and how many characters are allowed?"}
    agent_client = agent
    before = agent_client.post("/api/knowledge/ask", json=q).json()
    assert not any("Gift" in c.get("document_title", "") for c in before["citations"])

    r = agent_client.post("/api/knowledge/documents", files={"file": ("gift-services.md", SAMPLE.read_bytes(), "text/markdown")})
    assert r.status_code == 202, r.text
    doc_id = r.json()["id"]
    doc = agent_client.get(f"/api/knowledge/documents/{doc_id}").json()  # background task has run
    assert doc["status"] == "indexed" and doc["chunk_count"] >= 2 and doc["title"].startswith("Gift Services")
    assert agent_client.post("/api/knowledge/documents", files={"file": ("again.md", SAMPLE.read_bytes(), "text/markdown")}).status_code == 409

    hits = agent_client.post("/api/knowledge/search", json={"query": "engraving characters carafe"}).json()["results"]
    assert hits[0]["document_id"] == doc_id

    after = agent_client.post("/api/knowledge/ask", json=q).json()
    assert after["validation"]["passed"] and not after["insufficient_evidence"]
    assert any(c["document_id"] == doc_id for c in after["citations"])
    assert "24 characters" in after["answer"]

    # Only leads may delete documents.
    assert agent_client.delete(f"/api/knowledge/documents/{doc_id}").status_code == 403
    lead = login(agent_client, "lead")
    assert lead.delete(f"/api/knowledge/documents/{doc_id}").status_code == 204
    assert all(h["document_id"] != doc_id for h in lead.post("/api/knowledge/search", json={"query": "engraving"}).json()["results"])


def test_ask_abstains_without_evidence(agent):
    r = agent.post("/api/knowledge/ask", json={"question": "What is the CEO's favourite quantum chromodynamics paper?"}).json()
    assert r["insufficient_evidence"] and r["citations"] == []


def test_analytics_is_computed_and_labelled(agent):
    a = agent.get("/api/analytics/summary").json()
    assert len(a["series"]) == 30
    assert a["provenance"]["tickets_synthetic"] == a["provenance"]["tickets_total"]
    assert a["totals"]["median_first_response_minutes"] is not None


def test_system_status_never_leaks_secrets(agent):
    s = agent.get("/api/system/status").json()
    assert "gemini_api_key" not in str(s) and s["llm"]["active_provider"] == "extractive"
