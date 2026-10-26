"""Bounded support agent implemented as an explicit LangGraph state machine.

    load_context → classify → plan_tools ┬─> lookup_order ─┐
                                    └─────────────────┴─> search_kb ─┬─> check_eligibility ─┐
                                                                     └──────────────────────┴─> draft_reply → decide → END

The graph is fixed: the model cannot add nodes, call unlisted tools or loop. Tool choice
is a deterministic policy over the classification, recorded with its rationale. Every node
writes an AgentStep row as it completes, so the audit trail survives partial failures."""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any, Callable, TypedDict

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.agent.classify import classify, classify_rules
from app.agent.rules import Eligibility, OrderFacts
from app.agent.tools import (
    EligibilityInput,
    KBSearchInput,
    OrderLookupInput,
    eligibility_tool,
    lookup_order,
    search_knowledge_base,
)
from app.config import get_settings
from app.db import utcnow
from app.generation.reply import Fact, ReplyContext, generate_reply
from app.generation.safety import detect_injection
from app.llm.providers import ExtractiveProvider, LLMError, LLMProvider
from app.models import AgentRun, AgentStep, ApprovalRequest, Draft, Ticket, User
from app.rag.retriever import Passage

log = logging.getLogger("supportiq.agent")

RUN_BUDGET_SECONDS = 120
ORDER_INTENTS = {"refund_request", "return_request", "order_status", "damaged_item", "billing"}
ELIGIBILITY_INTENTS = {"refund_request", "return_request", "damaged_item"}
PRIORITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}


class AgentState(TypedDict, total=False):
    ticket_id: int
    subject: str
    message: str
    history: list[list[str]]
    customer: dict[str, Any]
    linked_order_id: str | None
    tone: str
    classification: dict[str, Any]
    plan: dict[str, Any]
    order: dict[str, Any] | None
    order_note: str
    passages: list[dict[str, Any]]
    eligibility: dict[str, Any] | None
    draft: dict[str, Any] | None
    decision: str
    decision_reason: str
    errors: list[str]


class AgentRuntime:
    def __init__(self, db: Session, llm: LLMProvider, run: AgentRun, user: User, now: datetime):
        self.db, self.llm, self.run, self.user, self.now = db, llm, run, user, now
        self.deadline = time.monotonic() + RUN_BUDGET_SECONDS
        self.ordinal = 0

    def record(self, node: str, tool: str, status: str, summary: str, inp: dict, out: dict, ms: int, attempts: int = 1):
        self.ordinal += 1
        self.db.add(AgentStep(run_id=self.run.id, ordinal=self.ordinal, node=node, tool=tool, status=status,
                              summary=summary, input=inp, output=out, duration_ms=ms, attempts=attempts))
        self.db.commit()


NodeResult = tuple[dict[str, Any], str, dict[str, Any], dict[str, Any]]  # update, summary, input, output


def traced(rt: AgentRuntime, node: str, tool: str, fn: Callable[[AgentState], NodeResult | None]):
    def wrapper(state: AgentState) -> dict[str, Any]:
        t0 = time.monotonic()
        if t0 > rt.deadline:
            rt.record(node, tool, "error", "Run time budget exceeded; step not executed.", {}, {}, 0)
            return {"errors": [*state.get("errors", []), f"{node}: time budget exceeded"]}
        try:
            res = fn(state)
        except Exception as exc:  # noqa: BLE001 - every failure must land in the trace
            log.exception("agent node %s failed", node)
            rt.record(node, tool, "error", f"{type(exc).__name__}: step failed", {}, {"error": str(exc)[:300]},
                      int((time.monotonic() - t0) * 1000))
            return {"errors": [*state.get("errors", []), f"{node}: {type(exc).__name__}"]}
        ms = int((time.monotonic() - t0) * 1000)
        if res is None:
            rt.record(node, tool, "skipped", "Not required for this ticket.", {}, {}, ms)
            return {}
        update, summary, inp, out = res
        rt.record(node, tool, "ok", summary, inp, out, ms)
        return update

    return wrapper


def _order_fact(o: OrderFacts, intent: str) -> Fact:
    items = ", ".join(f"{i['name']} x{i.get('qty', 1)}" for i in o.items)
    delivered = o.delivered_at.date().isoformat() if o.delivered_at else "not delivered"
    text = (f"Order {o.id}: status {o.status}; placed {o.placed_at.date().isoformat()}; delivered {delivered}; "
            f"total ${o.total_cents / 100:,.2f}; items: {items}")
    customer_text = ""
    if intent == "order_status":
        customer_text = (f"Order {o.id} was delivered on {delivered}." if o.delivered_at
                         else f"Order {o.id} is currently marked as {o.status} (placed on {o.placed_at.date().isoformat()}).")
    return Fact(id="ORDER", label="Order record", text=text, customer_text=customer_text)


def _needs_eligibility(s: AgentState) -> bool:
    order = s.get("order")
    if not order or "check_eligibility" not in s["plan"]["tools"]:
        return False
    # For delivery questions the rules only matter while the parcel is still in transit.
    return s["classification"]["intent"] != "order_status" or order["status"] == "shipped"


def build_graph(rt: AgentRuntime):
    db, settings = rt.db, get_settings()

    def load_context(state: AgentState) -> NodeResult:
        t = db.get(Ticket, state["ticket_id"])
        customer_msgs = [m for m in t.messages if m.author_type == "customer" and not m.is_internal]
        latest = customer_msgs[-1].body if customer_msgs else t.subject
        history = [[m.author_type, m.body] for m in t.messages if not m.is_internal][:-1]
        cust = {"id": t.customer.id, "name": t.customer.name, "tier": t.customer.tier}
        upd = {"subject": t.subject, "message": latest, "history": history, "customer": cust, "linked_order_id": t.order_id}
        return upd, f"Loaded ticket #{t.id} with {len(t.messages)} messages for a {t.customer.tier} customer.", \
            {"ticket_id": t.id}, {"messages": len(t.messages), "customer_tier": t.customer.tier, "linked_order": t.order_id}

    def classify_node(state: AgentState) -> NodeResult:
        method = "rules"
        try:
            c, method = classify(state["subject"], state["message"], rt.llm)
        except LLMError:
            c, method = classify_rules(state["subject"], state["message"]), "rules (model unavailable)"
        cdict = c.model_dump()
        cdict["method"] = method
        cdict["injection_signals"] = detect_injection(state["message"])
        flags = f"; flags: {', '.join(c.sensitive_flags)}" if c.sensitive_flags else ""
        return {"classification": cdict}, \
            f"Classified as {c.intent.replace('_', ' ')} ({c.urgency} urgency, {c.sentiment}){flags}. Method: {method}.", \
            {"subject": state["subject"][:120]}, cdict

    def plan(state: AgentState) -> NodeResult:
        c = state["classification"]
        tools, why = [], []
        order_id = c.get("order_id") or state.get("linked_order_id")
        if c["intent"] in ORDER_INTENTS:
            tools.append("lookup_order")
            why.append(f"Intent '{c['intent']}' depends on order data" + ("" if order_id else " (no order number given yet)."))
        tools.append("search_knowledge_base")
        why.append("Policy or product evidence is needed to ground any reply.")
        if c["intent"] in ELIGIBILITY_INTENTS:
            tools.append("check_eligibility")
            why.append("Return/refund requests are checked against explicit business rules, not model judgement.")
        elif c["intent"] == "order_status":
            tools.append("check_eligibility")
            why.append("Delivery questions run the lost-package rule (RR-5) if the order is still in transit.")
        tools.append("draft_reply")
        return {"plan": {"tools": tools, "rationale": why, "order_id": order_id}}, \
            f"Selected tools: {', '.join(tools)}.", {"intent": c["intent"]}, {"tools": tools, "rationale": why}

    def lookup(state: AgentState) -> NodeResult:
        order_id = state["plan"].get("order_id")
        if not order_id:
            note = "Customer did not include an order number and none is linked to the ticket."
            return {"order": None, "order_note": note}, note, {}, {"found": False}
        res = lookup_order(db, OrderLookupInput(order_id=order_id, customer_id=state["customer"]["id"]))
        if not res.found:
            return {"order": None, "order_note": res.reason}, res.reason, {"order_id": order_id}, res.model_dump(mode="json")
        o = res.order
        return {"order": o.model_dump(mode="json"), "order_note": ""}, \
            f"Found order {o.id}: {o.status}, ${o.total_cents / 100:,.2f}.", {"order_id": order_id}, res.model_dump(mode="json")

    def search_kb(state: AgentState) -> NodeResult:
        query = f"{state['subject']}\n{state['message']}"[:1500]
        out = search_knowledge_base(db, KBSearchInput(query=query, k=settings.retrieval_top_k))
        ps = [p.model_dump() for p in out.passages]
        brief = [{"chunk_id": p["chunk_id"], "document_title": p["document_title"], "section": p["section"], "score": p["score"]} for p in ps]
        summary = (f"Retrieved {len(ps)} passages above the relevance threshold, top: {ps[0]['document_title']} › {ps[0]['section'] or 'body'} ({ps[0]['score']:.2f})."
                   if ps else "No knowledge-base passage met the relevance threshold.")
        return {"passages": ps}, summary, {"query": query[:300], "k": settings.retrieval_top_k}, {"passages": brief}

    def eligibility(state: AgentState) -> NodeResult:
        o = OrderFacts.model_validate(state["order"])
        e = eligibility_tool(EligibilityInput(order=o, intent=state["classification"]["intent"], as_of=rt.now))
        verdict = "eligible" if e.eligible else "not eligible"
        return {"eligibility": e.model_dump()}, f"{verdict.capitalize()}: {e.reasons[0]} Rules: {', '.join(e.rule_ids)}.", \
            {"order_id": o.id, "intent": state["classification"]["intent"]}, e.model_dump()

    def draft(state: AgentState) -> NodeResult:
        c = state["classification"]
        facts: list[Fact] = []
        if state.get("order"):
            facts.append(_order_fact(OrderFacts.model_validate(state["order"]), c["intent"]))
        elif c["intent"] in ORDER_INTENTS:
            facts.append(Fact(id="MISSING_ORDER", label="Order lookup",
                              text=f"No verified order. {state.get('order_note', '')} Ask the customer to confirm their order number.",
                              customer_text="Could you reply with your order number (it starts with HC-)? That will let me look into this right away."))
        if state.get("eligibility"):
            e = Eligibility.model_validate(state["eligibility"])
            facts.append(Fact(id="ELIGIBILITY", label="Business-rule check",
                              text=f"eligible={e.eligible}; action={e.action}; {' '.join(e.reasons)} (rules {', '.join(e.rule_ids)}). {e.customer_text}",
                              customer_text=e.customer_text))
        tone = state.get("tone") or ("empathetic" if c["sentiment"] in ("frustrated", "angry") else "friendly")
        ctx = ReplyContext(
            customer_name=state["customer"]["name"], customer_message=state["message"], agent_name=rt.user.name.split()[0],
            tone=tone, passages=[Passage(**p) for p in state.get("passages", [])], facts=facts,
            history=[(a, b) for a, b in state.get("history", [])],
        )
        note = ""
        try:
            r = generate_reply(ctx, rt.llm)
        except LLMError as exc:
            note = f" Model failed ({exc}); fell back to extractive drafting."
            r = generate_reply(ctx, ExtractiveProvider())
        d = {"body": r.body, "citations": r.citations, "validation": r.validation, "insufficient_evidence": r.insufficient_evidence,
             "confidence": r.confidence, "missing_information": r.missing_information, "provider": r.provider, "model": r.model, "tone": tone}
        v = r.validation
        check = "passed" if v["passed"] else "flagged issues"
        return {"draft": d}, f"Drafted {'an' if tone[0] in 'aeiou' else 'a'} {tone} reply with {len(r.citations)} validated citations via {r.provider}; validation {check}.{note}", \
            {"facts": [f.id for f in facts], "passages": [p.chunk_id for p in ctx.passages], "tone": tone}, \
            {"validation": v, "confidence": r.confidence, "insufficient_evidence": r.insufficient_evidence}

    def decide(state: AgentState) -> NodeResult:
        c, d, e = state.get("classification") or {}, state.get("draft"), state.get("eligibility")
        reasons: list[str] = []
        if state.get("errors"):
            reasons.append("A workflow step failed: " + "; ".join(state["errors"]))
        if c.get("sensitive_flags"):
            reasons.append("Sensitive signals: " + ", ".join(c["sensitive_flags"]))
        if d is None:
            reasons.append("No draft could be produced")
        elif d["insufficient_evidence"]:
            reasons.append("Knowledge base lacks sufficient evidence")
        elif d["confidence"] == "low":
            reasons.append("Draft failed citation/number validation")
        if e and e["action"] == "investigate_shipment":
            reasons.append("Lost-package investigation needed")
        if e and not e["eligible"] and c.get("intent") in ("refund_request", "return_request", "damaged_item") and e["action"] == "none":
            reasons.append("Request falls outside policy; any exception needs a lead's decision")

        escalate = bool(reasons)
        ticket = db.get(Ticket, state["ticket_id"])
        draft_row = None
        if d is not None:
            draft_row = Draft(ticket_id=ticket.id, agent_run_id=rt.run.id, body=d["body"], original_body=d["body"], tone=d["tone"],
                              provider=d["provider"], model=d["model"], citations=d["citations"], validation=d["validation"],
                              insufficient_evidence=d["insufficient_evidence"], confidence=d["confidence"], created_by=rt.user.id)
            db.add(draft_row)
            db.flush()

        proposed: list[dict[str, Any]] = []
        if draft_row is not None:
            proposed.append({"kind": "send_reply", "summary": "Send the drafted reply to the customer",
                             "role": "lead" if escalate else "agent", "payload": {"draft_id": draft_row.id}})
        if e and e["eligible"] and not escalate:
            o = state["order"]
            kind = {"cancel_and_refund": "refund", "return_for_refund": "return_label", "replacement_or_refund": "refund"}[e["action"]]
            label = {"refund": "Approve refund", "return_label": "Approve return and refund on receipt"}[kind]
            proposed.append({"kind": kind, "summary": f"{label} of ${e['amount_cents'] / 100:,.2f} for order {o['id']}",
                             "role": "lead" if e["requires_lead_approval"] else "agent",
                             "payload": {"order_id": o["id"], "amount_cents": e["amount_cents"], "action": e["action"], "rule_ids": e["rule_ids"]}})
        for p in proposed:
            db.add(ApprovalRequest(ticket_id=ticket.id, run_id=rt.run.id, draft_id=draft_row.id if draft_row else None, kind=p["kind"],
                                   summary=p["summary"], payload=p["payload"], required_role=p["role"]))

        ticket.category = c.get("category", ticket.category)
        if PRIORITY_RANK.get(c.get("urgency", "normal"), 1) > PRIORITY_RANK.get(ticket.priority, 1):
            ticket.priority = c["urgency"]
        if escalate:
            ticket.status = "escalated"
            ticket.escalation_reason = "; ".join(reasons)
        db.commit()
        decision = "escalate" if escalate else "request_approval"
        reason = "; ".join(reasons) if escalate else f"Evidence and rules check out; {len(proposed)} action(s) await human approval."
        return {"decision": decision, "decision_reason": reason}, \
            ("Escalated to a team lead. " if escalate else "Requested human approval. ") + reason, \
            {}, {"decision": decision, "proposed_actions": [{k: v for k, v in p.items() if k != "payload"} for p in proposed]}

    g = StateGraph(AgentState)
    g.add_node("load_context", traced(rt, "load_context", "get_ticket_context", load_context))
    g.add_node("classify", traced(rt, "classify", "classify_ticket", classify_node))
    g.add_node("plan_tools", traced(rt, "plan_tools", "", plan))
    g.add_node("lookup_order", traced(rt, "lookup_order", "lookup_order", lookup))
    g.add_node("search_kb", traced(rt, "search_kb", "search_knowledge_base", search_kb))
    g.add_node("check_eligibility", traced(rt, "check_eligibility", "check_eligibility", eligibility))
    g.add_node("draft_reply", traced(rt, "draft_reply", "generate_grounded_reply", draft))
    g.add_node("decide", traced(rt, "decide", "request_approval", decide))

    g.add_edge(START, "load_context")
    g.add_edge("load_context", "classify")
    g.add_edge("classify", "plan_tools")
    g.add_conditional_edges("plan_tools", lambda s: "lookup_order" if "lookup_order" in (s.get("plan") or {}).get("tools", []) else "search_kb",
                            ["lookup_order", "search_kb"])
    g.add_edge("lookup_order", "search_kb")
    g.add_conditional_edges(
        "search_kb",
        lambda s: "check_eligibility" if _needs_eligibility(s) else "draft_reply",
        ["check_eligibility", "draft_reply"],
    )
    g.add_edge("check_eligibility", "draft_reply")
    g.add_edge("draft_reply", "decide")
    g.add_edge("decide", END)
    return g.compile()


def run_agent(db: Session, ticket: Ticket, user: User, llm: LLMProvider, *, tone: str | None = None,
              now: datetime | None = None) -> AgentRun:
    run = AgentRun(ticket_id=ticket.id, status="running", provider=f"{llm.name}:{llm.model}", created_by=user.id)
    db.add(run)
    db.commit()
    rt = AgentRuntime(db, llm, run, user, now or utcnow())
    graph = build_graph(rt)
    init: AgentState = {"ticket_id": ticket.id, "errors": [], "tone": tone or ""}
    try:
        final = graph.invoke(init, {"recursion_limit": 20})
        run.classification = final.get("classification") or {}
        run.decision = final.get("decision", "")
        run.decision_reason = final.get("decision_reason", "")
        run.final_state = {k: final.get(k) for k in ("plan", "order", "order_note", "eligibility", "errors")}
        run.status = {"escalate": "escalated", "request_approval": "awaiting_approval"}.get(run.decision, "failed")
        if run.status == "failed":
            run.error = "; ".join(final.get("errors") or ["Agent ended without a decision"])
    except Exception as exc:  # noqa: BLE001
        log.exception("agent run %s crashed", run.id)
        db.rollback()
        run = db.get(AgentRun, run.id)
        run.status, run.error = "failed", f"{type(exc).__name__}: {str(exc)[:300]}"
    run.finished_at = utcnow()
    db.commit()
    db.refresh(run)
    return run
