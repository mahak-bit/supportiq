"""Domain operations shared by API routes. Every consequential action is gated here."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.graph import _order_fact
from app.agent.rules import Eligibility, OrderFacts
from app.agent.tools import OrderLookupInput, lookup_order
from app.db import utcnow
from app.generation.reply import Fact, ReplyContext, generate_reply
from app.llm.providers import LLMProvider
from app.models import AgentRun, ApprovalRequest, Draft, Message, Ticket, User
from app.rag.retriever import retrieve
from app.security import has_role


def latest_customer_message(ticket: Ticket) -> str:
    msgs = [m for m in ticket.messages if m.author_type == "customer" and not m.is_internal]
    return msgs[-1].body if msgs else ticket.subject


def create_draft(db: Session, ticket: Ticket, user: User, llm: LLMProvider, tone: str, instructions: str = "") -> Draft:
    """One-shot grounded draft (outside a full agent run). Reuses verified facts from the
    latest agent run when available, otherwise looks up the linked order directly."""
    message = latest_customer_message(ticket)
    run = db.scalar(select(AgentRun).where(AgentRun.ticket_id == ticket.id).order_by(AgentRun.id.desc()))
    facts: list[Fact] = []
    intent = (run.classification or {}).get("intent", "other") if run else "other"
    order = (run.final_state or {}).get("order") if run else None
    if order is None and ticket.order_id:
        res = lookup_order(db, OrderLookupInput(order_id=ticket.order_id, customer_id=ticket.customer_id))
        order = res.order.model_dump(mode="json") if res.found else None
    if order:
        facts.append(_order_fact(OrderFacts.model_validate(order), intent))
    elig = (run.final_state or {}).get("eligibility") if run else None
    if elig:
        e = Eligibility.model_validate(elig)
        facts.append(Fact(id="ELIGIBILITY", label="Business-rule check",
                          text=f"eligible={e.eligible}; action={e.action}; {' '.join(e.reasons)}. {e.customer_text}",
                          customer_text=e.customer_text))
    ctx = ReplyContext(
        customer_name=ticket.customer.name, customer_message=message, agent_name=user.name.split()[0], tone=tone,  # type: ignore[arg-type]
        passages=retrieve(db, f"{ticket.subject}\n{message}"), facts=facts, agent_instructions=instructions,
        history=[(m.author_type, m.body) for m in ticket.messages if not m.is_internal][:-1],
    )
    r = generate_reply(ctx, llm)
    draft = Draft(ticket_id=ticket.id, agent_run_id=run.id if run else None, body=r.body, original_body=r.body, tone=tone,
                  provider=r.provider, model=r.model, citations=r.citations, validation=r.validation,
                  insufficient_evidence=r.insufficient_evidence, confidence=r.confidence, created_by=user.id)
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def _system_note(ticket: Ticket, body: str) -> Message:
    return Message(ticket_id=ticket.id, author_type="system", author_name="SupportIQ", body=body, is_internal=True)


def send_draft(db: Session, draft: Draft, user: User, final_body: str | None, approval: ApprovalRequest | None = None) -> Message:
    """Human-approved send. There is no outbound email integration: the reply is recorded on
    the ticket with delivery='simulated' and the UI says so explicitly."""
    if draft.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "This draft has already been sent or discarded.")
    ticket = db.get(Ticket, draft.ticket_id)
    pending = db.scalars(select(ApprovalRequest).where(ApprovalRequest.ticket_id == ticket.id, ApprovalRequest.kind == "send_reply",
                                                     ApprovalRequest.status == "pending")).all()
    own = approval or next((a for a in pending if a.draft_id == draft.id), None)
    if own and not has_role(user, own.required_role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This reply was escalated and must be approved by a team lead.")
    if ticket.status == "escalated" and not has_role(user, "lead"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This ticket is escalated: a team lead must approve replies.")

    body = (final_body if final_body is not None else draft.body).strip()
    if not body:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Reply cannot be empty.")
    now = utcnow()
    draft.body, draft.status, draft.approved_by, draft.approved_at = body, "sent", user.id, now
    msg = Message(ticket_id=ticket.id, author_type="agent", author_name=user.name, body=body, delivery="simulated", created_at=now)
    db.add(msg)
    for a in pending:
        if a.id == (own.id if own else None):
            a.status, a.decided_by, a.decided_at = "approved", user.id, now
        else:
            a.status, a.decided_by, a.decided_at, a.decision_note = "rejected", user.id, now, f"Superseded by draft #{draft.id}"
    if own is None:  # record the human approval for the audit trail
        db.add(ApprovalRequest(ticket_id=ticket.id, draft_id=draft.id, kind="send_reply", summary="Send reply to customer",
                               status="approved", decided_by=user.id, decided_at=now, required_role="agent"))
    ticket.first_response_at = ticket.first_response_at or now
    if ticket.status in ("open", "escalated"):
        ticket.status = "pending"
    ticket.updated_at = now
    db.commit()
    return msg


def decide_approval(db: Session, approval: ApprovalRequest, user: User, decision: str, note: str, final_body: str | None) -> ApprovalRequest:
    if approval.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided.")
    if not has_role(user, approval.required_role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only a {approval.required_role} can decide this request.")
    ticket = db.get(Ticket, approval.ticket_id)
    now = utcnow()
    if decision == "approve" and approval.kind == "send_reply":
        draft = db.get(Draft, approval.draft_id)
        send_draft(db, draft, user, final_body, approval)
        approval.decision_note = note
        db.commit()
        return approval

    approval.status = "approved" if decision == "approve" else "rejected"
    approval.decided_by, approval.decided_at, approval.decision_note = user.id, now, note
    if approval.kind in ("refund", "return_label"):
        amount = approval.payload.get("amount_cents", 0) / 100
        if decision == "approve":
            text = (f"{user.name} approved: {approval.summary}. Recorded for processing in the payment/fulfilment system. "
                    f"SupportIQ has not moved money or created shipping labels (${amount:,.2f}).")
        else:
            text = f"{user.name} rejected: {approval.summary}." + (f" Note: {note}" if note else "")
        db.add(_system_note(ticket, text))
    elif decision == "reject" and approval.kind == "send_reply":
        db.add(_system_note(ticket, f"{user.name} rejected the drafted reply." + (f" Note: {note}" if note else "")))
    ticket.updated_at = now
    db.commit()
    return approval
