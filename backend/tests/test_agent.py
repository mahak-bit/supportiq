"""Agent workflow tests: routing, business rules, escalation, approvals and role checks,
plus LLM-path behaviour using a scripted fake provider."""

from __future__ import annotations

from app.generation.schemas import Claim, ReplyOutput, TicketClassification
from app.llm.providers import LLMError, LLMProvider, set_provider_override
from tests.conftest import login, ticket_by_subject


def _run(c, subject):
    t = ticket_by_subject(c, subject)
    r = c.post(f"/api/tickets/{t['id']}/agent-runs", json={})
    assert r.status_code == 201, r.text
    return t, r.json()


def test_damaged_item_requests_refund_approval(agent):
    t, run = _run(agent, "Plates arrived cracked")
    assert run["status"] == "awaiting_approval"
    nodes = [s["node"] for s in run["steps"]]
    assert nodes == ["load_context", "classify", "plan_tools", "lookup_order", "search_kb", "check_eligibility", "draft_reply", "decide"]
    assert all(s["status"] == "ok" for s in run["steps"])
    detail = agent.get(f"/api/tickets/{t['id']}").json()
    kinds = {a["kind"]: a for a in detail["approvals"]}
    assert kinds["refund"]["payload"]["amount_cents"] == 14200 and kinds["refund"]["required_role"] == "agent"
    draft = detail["drafts"][0]
    assert draft["validation"]["passed"] and any(c["id"] == "ELIGIBILITY" for c in draft["citations"])


def test_human_approval_sends_simulated_reply(agent):
    t = ticket_by_subject(agent, "Plates arrived cracked")
    detail = agent.get(f"/api/tickets/{t['id']}").json()
    send = next(a for a in detail["approvals"] if a["kind"] == "send_reply")
    r = agent.post(f"/api/approvals/{send['id']}/decision", json={"decision": "approve", "final_body": "Hi Daniel, edited reply."})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    detail = agent.get(f"/api/tickets/{t['id']}").json()
    sent = [m for m in detail["messages"] if m["author_type"] == "agent" and not m["is_internal"]]
    assert sent[-1]["body"] == "Hi Daniel, edited reply." and sent[-1]["delivery"] == "simulated"
    assert detail["status"] == "pending" and detail["drafts"][0]["status"] == "sent"
    # Deciding twice is rejected.
    assert agent.post(f"/api/approvals/{send['id']}/decision", json={"decision": "approve"}).status_code == 409


def test_refund_approval_records_note_without_moving_money(agent):
    t = ticket_by_subject(agent, "Plates arrived cracked")
    refund = next(a for a in agent.get(f"/api/tickets/{t['id']}").json()["approvals"] if a["kind"] == "refund")
    assert agent.post(f"/api/approvals/{refund['id']}/decision", json={"decision": "approve"}).status_code == 200
    notes = [m["body"] for m in agent.get(f"/api/tickets/{t['id']}").json()["messages"] if m["is_internal"]]
    assert any("has not moved money" in n for n in notes)


def test_prompt_injection_is_escalated_and_needs_lead(client):
    agent = login(client, "agent")
    t, run = _run(agent, "Store manager refund authorisation")
    assert run["status"] == "escalated"
    assert "prompt_injection" in run["classification"]["sensitive_flags"]
    detail = agent.get(f"/api/tickets/{t['id']}").json()
    assert detail["status"] == "escalated"
    assert not any(a["kind"] == "refund" for a in detail["approvals"])  # never proposes the demanded refund
    draft = detail["drafts"][0]
    assert "processed" not in draft["body"].lower()
    send = next(a for a in detail["approvals"] if a["kind"] == "send_reply")
    assert send["required_role"] == "lead"
    assert agent.post(f"/api/approvals/{send['id']}/decision", json={"decision": "approve"}).status_code == 403
    lead = login(client, "lead")
    assert lead.post(f"/api/approvals/{send['id']}/decision", json={"decision": "reject", "note": "Will call"}).status_code == 200


def test_large_cancellation_requires_lead(client):
    agent = login(client, "agent")
    t, run = _run(agent, "Cancel my order please")
    assert run["classification"]["intent"] == "refund_request"
    refund = next(a for a in agent.get(f"/api/tickets/{t['id']}").json()["approvals"] if a["kind"] == "refund")
    assert refund["required_role"] == "lead" and refund["payload"]["amount_cents"] == 36200
    assert agent.post(f"/api/approvals/{refund['id']}/decision", json={"decision": "approve"}).status_code == 403


def test_missing_order_lost_package_and_out_of_policy(agent):
    _, run = _run(agent, "Duvet cover still hasn't arrived")
    assert run["status"] == "escalated" and "Lost-package" in run["decision_reason"]
    _, run = _run(agent, "Refund for wool throw")
    assert run["status"] == "escalated" and "outside policy" in run["decision_reason"]


# ---------------- LLM path with a scripted provider
class ScriptedLLM(LLMProvider):
    name, model = "scripted", "fake-1"

    def __init__(self, reply: ReplyOutput | None, fail: bool = False):
        self.reply, self.fail = reply, fail

    def _generate(self, system, prompt, schema):
        assert "untrusted" in system  # the safety contract is always in the system prompt
        if self.fail:
            raise RuntimeError("network down")
        if schema is TicketClassification:
            return TicketClassification(intent="product_question", category="product", urgency="low", sentiment="neutral",
                                        order_id="HC-99999", sensitive_flags=[], summary="Bulb question")
        return self.reply


def test_llm_hallucinated_citation_is_caught_and_escalated(agent, monkeypatch):
    monkeypatch.setattr("app.llm.providers.time.sleep", lambda *_: None)
    bad = ReplyOutput(reply="Hi Lucas, any 100W bulb works fine.", claims=[Claim(statement="100W ok", source_ids=["D42-C001"])],
                      insufficient_evidence=False, missing_information="", confidence="high")
    set_provider_override(ScriptedLLM(bad))
    try:
        t, run = _run(agent, "Which bulb for the Lumen lamp?")
    finally:
        set_provider_override(None)
    assert run["classification"]["order_id"] is None  # model-invented order IDs are discarded
    assert run["status"] == "escalated" and "validation" in run["decision_reason"]
    draft = agent.get(f"/api/tickets/{t['id']}").json()["drafts"][0]
    assert draft["validation"]["invalid_citation_ids"] == ["D42-C001"] and "100" in draft["validation"]["unverified_numbers"]


def test_llm_failure_falls_back_and_is_traced(agent, monkeypatch):
    monkeypatch.setattr("app.llm.providers.time.sleep", lambda *_: None)
    set_provider_override(ScriptedLLM(None, fail=True))
    try:
        _, run = _run(agent, "Return pour-over set")
    finally:
        set_provider_override(None)
    classify = next(s for s in run["steps"] if s["node"] == "classify")
    draft = next(s for s in run["steps"] if s["node"] == "draft_reply")
    assert "model unavailable" in classify["summary"] and "fell back to extractive" in draft["summary"]


def test_llm_error_type_is_safe():
    assert issubclass(LLMError, RuntimeError)
