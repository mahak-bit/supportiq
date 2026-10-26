from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.agent.graph import run_agent
from app.db import get_db, utcnow
from app.llm.providers import get_llm
from app.models import AgentRun, ApprovalRequest, Customer, Draft, Message, Ticket, User
from app.schemas import (
    AgentRunOut,
    AgentRunRequest,
    ApprovalDecision,
    ApprovalOut,
    CustomerOut,
    DraftEdit,
    DraftOut,
    DraftRequest,
    EscalateIn,
    MessageOut,
    NoteIn,
    TicketDetail,
    TicketListItem,
    TicketListOut,
    TicketPatch,
    TicketBrief,
)
from app.security import ai_rate_limit, current_user
from app.services import create_draft, decide_approval, send_draft

router = APIRouter(prefix="/api", tags=["tickets"])


def _get_ticket(db: Session, ticket_id: int) -> Ticket:
    t = db.get(Ticket, ticket_id)
    if t is None:
        raise HTTPException(404, "Ticket not found.")
    return t


def _list_item(t: Ticket, pending: int) -> TicketListItem:
    visible = [m for m in t.messages if not m.is_internal]
    item = TicketListItem.model_validate(t)
    item.preview = (visible[-1].body if visible else "")[:180]
    item.message_count = len(visible)
    item.pending_approvals = pending
    return item


@router.get("/tickets", response_model=TicketListOut)
def list_tickets(
    q: str = Query("", max_length=200),
    status: str = Query("active", pattern="^(all|active|open|pending|escalated|resolved)$"),
    priority: str = Query("", pattern="^(|low|normal|high|urgent)$"),
    category: str = Query("", max_length=30),
    sort: str = Query("priority", pattern="^(newest|oldest|priority)$"),
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> TicketListOut:
    stmt = select(Ticket).options(selectinload(Ticket.messages), selectinload(Ticket.customer))
    if q.strip():
        like = f"%{q.strip()}%"
        msg_match = select(Message.ticket_id).where(Message.body.ilike(like))
        stmt = stmt.join(Customer).where(or_(Ticket.subject.ilike(like), Customer.name.ilike(like), Customer.email.ilike(like),
                                             Ticket.order_id.ilike(like), Ticket.id.in_(msg_match)))
    if priority:
        stmt = stmt.where(Ticket.priority == priority)
    if category:
        stmt = stmt.where(Ticket.category == category)
    base = stmt
    if status == "active":
        stmt = stmt.where(Ticket.status != "resolved")
    elif status != "all":
        stmt = stmt.where(Ticket.status == status)

    tickets = list(db.scalars(stmt).unique())
    rank = {"urgent": 0, "high": 1, "normal": 2, "low": 3}
    if sort == "priority":
        tickets.sort(key=lambda t: (rank.get(t.priority, 9), -t.created_at.timestamp()))
    else:
        tickets.sort(key=lambda t: t.created_at, reverse=sort == "newest")

    pending_rows = db.execute(select(ApprovalRequest.ticket_id, func.count()).where(ApprovalRequest.status == "pending")
                              .group_by(ApprovalRequest.ticket_id)).all()
    pending = dict(pending_rows)
    # Tab counts honour search/priority/category filters but not the status filter.
    counts: dict[str, int] = {"all": 0, "active": 0, "open": 0, "pending": 0, "escalated": 0, "resolved": 0}
    for t in db.scalars(base).unique():
        counts["all"] += 1
        counts[t.status] = counts.get(t.status, 0) + 1
        if t.status != "resolved":
            counts["active"] += 1
    return TicketListOut(items=[_list_item(t, pending.get(t.id, 0)) for t in tickets[:200]], total=len(tickets), counts=counts)


def _detail(db: Session, t: Ticket) -> TicketDetail:
    pending = db.scalar(select(func.count()).where(ApprovalRequest.ticket_id == t.id, ApprovalRequest.status == "pending")) or 0
    base = _list_item(t, pending).model_dump()
    customer = CustomerOut.model_validate(t.customer)
    customer.previous_tickets = [TicketBrief.model_validate(x) for x in sorted(t.customer.tickets, key=lambda x: x.created_at, reverse=True)
                                 if x.id != t.id][:8]
    run = db.scalar(select(AgentRun).options(selectinload(AgentRun.steps)).where(AgentRun.ticket_id == t.id).order_by(AgentRun.id.desc()))
    drafts = db.scalars(select(Draft).where(Draft.ticket_id == t.id).order_by(Draft.id.desc())).all()
    approvals = db.scalars(select(ApprovalRequest).where(ApprovalRequest.ticket_id == t.id).order_by(ApprovalRequest.id.desc())).all()
    return TicketDetail(
        **base,
        escalation_reason=t.escalation_reason,
        first_response_at=t.first_response_at,
        resolved_at=t.resolved_at,
        messages=[MessageOut.model_validate(m) for m in t.messages],
        customer_profile=customer,
        order=t.order,
        drafts=[DraftOut.model_validate(d) for d in drafts],
        latest_run=AgentRunOut.model_validate(run) if run else None,
        approvals=[ApprovalOut.model_validate(a) for a in approvals],
    )


@router.get("/tickets/{ticket_id}", response_model=TicketDetail)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)) -> TicketDetail:
    return _detail(db, _get_ticket(db, ticket_id))


@router.patch("/tickets/{ticket_id}", response_model=TicketDetail)
def update_ticket(ticket_id: int, body: TicketPatch, db: Session = Depends(get_db), user: User = Depends(current_user)) -> TicketDetail:
    t = _get_ticket(db, ticket_id)
    if body.status and body.status != t.status:
        if t.status == "escalated" and body.status == "resolved" and user.role != "lead":
            raise HTTPException(403, "Escalated tickets can only be resolved by a team lead.")
        db.add(Message(ticket_id=t.id, author_type="system", author_name="SupportIQ", is_internal=True,
                       body=f"{user.name} changed status from {t.status} to {body.status}."))
        t.status = body.status
        t.resolved_at = utcnow() if body.status == "resolved" else None
    if body.priority:
        t.priority = body.priority
    t.updated_at = utcnow()
    db.commit()
    return _detail(db, t)


@router.post("/tickets/{ticket_id}/notes", response_model=MessageOut, status_code=201)
def add_note(ticket_id: int, body: NoteIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Message:
    t = _get_ticket(db, ticket_id)
    m = Message(ticket_id=t.id, author_type="agent", author_name=user.name, body=body.body.strip(), is_internal=True)
    db.add(m)
    t.updated_at = utcnow()
    db.commit()
    return m


@router.post("/tickets/{ticket_id}/escalate", response_model=TicketDetail)
def escalate(ticket_id: int, body: EscalateIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> TicketDetail:
    t = _get_ticket(db, ticket_id)
    t.status, t.escalation_reason, t.updated_at = "escalated", body.reason.strip(), utcnow()
    db.add(Message(ticket_id=t.id, author_type="system", author_name="SupportIQ", is_internal=True,
                   body=f"{user.name} escalated this ticket to a team lead: {body.reason.strip()}"))
    db.commit()
    return _detail(db, t)


@router.post("/tickets/{ticket_id}/drafts", response_model=DraftOut, status_code=201)
def new_draft(ticket_id: int, body: DraftRequest, db: Session = Depends(get_db), user: User = Depends(ai_rate_limit)) -> Draft:
    return create_draft(db, _get_ticket(db, ticket_id), user, get_llm(), body.tone, body.instructions)


@router.patch("/drafts/{draft_id}", response_model=DraftOut)
def edit_draft(draft_id: int, body: DraftEdit, db: Session = Depends(get_db), _: User = Depends(current_user)) -> Draft:
    d = db.get(Draft, draft_id)
    if d is None:
        raise HTTPException(404, "Draft not found.")
    if d.status != "draft":
        raise HTTPException(409, "Sent drafts cannot be edited.")
    d.body = body.body
    db.commit()
    return d


@router.post("/drafts/{draft_id}/send", response_model=MessageOut)
def approve_and_send(draft_id: int, body: DraftEdit, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Message:
    d = db.get(Draft, draft_id)
    if d is None:
        raise HTTPException(404, "Draft not found.")
    return send_draft(db, d, user, body.body)


@router.post("/drafts/{draft_id}/discard", response_model=DraftOut)
def discard_draft(draft_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)) -> Draft:
    d = db.get(Draft, draft_id)
    if d is None:
        raise HTTPException(404, "Draft not found.")
    if d.status == "draft":
        d.status = "discarded"
        db.commit()
    return d


@router.post("/tickets/{ticket_id}/agent-runs", response_model=AgentRunOut, status_code=201)
def start_agent_run(ticket_id: int, body: AgentRunRequest, db: Session = Depends(get_db), user: User = Depends(ai_rate_limit)) -> AgentRun:
    t = _get_ticket(db, ticket_id)
    if t.status == "resolved":
        raise HTTPException(409, "Reopen the ticket before running the agent.")
    run = run_agent(db, t, user, get_llm(), tone=body.tone)
    return db.scalar(select(AgentRun).options(selectinload(AgentRun.steps)).where(AgentRun.id == run.id))


@router.get("/agent-runs/{run_id}", response_model=AgentRunOut)
def get_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)) -> AgentRun:
    run = db.scalar(select(AgentRun).options(selectinload(AgentRun.steps)).where(AgentRun.id == run_id))
    if run is None:
        raise HTTPException(404, "Agent run not found.")
    return run


@router.get("/approvals", response_model=list[ApprovalOut])
def list_approvals(status: str = Query("pending", pattern="^(pending|approved|rejected|all)$"), db: Session = Depends(get_db),
                   _: User = Depends(current_user)) -> list[ApprovalOut]:
    stmt = select(ApprovalRequest, Ticket.subject).join(Ticket).order_by(ApprovalRequest.id.desc()).limit(200)
    if status != "all":
        stmt = stmt.where(ApprovalRequest.status == status)
    out = []
    for a, subject in db.execute(stmt).all():
        item = ApprovalOut.model_validate(a)
        item.ticket_subject = subject
        out.append(item)
    return out


@router.post("/approvals/{approval_id}/decision", response_model=ApprovalOut)
def decide(approval_id: int, body: ApprovalDecision, db: Session = Depends(get_db), user: User = Depends(current_user)) -> ApprovalRequest:
    a = db.get(ApprovalRequest, approval_id)
    if a is None:
        raise HTTPException(404, "Approval request not found.")
    return decide_approval(db, a, user, body.decision, body.note, body.final_body)
