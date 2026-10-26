"""Typed API contracts (request validation + response shapes)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.generation.schemas import Tone

TicketStatus = Literal["open", "pending", "escalated", "resolved"]
Priority = Literal["low", "normal", "high", "urgent"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth
class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=200)


class UserOut(ORM):
    id: int
    email: str
    name: str
    role: str


# ---- customers / orders
class OrderOut(ORM):
    id: str
    status: str
    placed_at: datetime
    delivered_at: datetime | None
    total_cents: int
    refunded_cents: int
    currency: str
    items: list[dict[str, Any]]
    payment_method: str


class CustomerBrief(ORM):
    id: int
    name: str
    email: str
    tier: str


class TicketBrief(ORM):
    id: int
    subject: str
    status: str
    priority: str
    category: str
    created_at: datetime


class CustomerOut(CustomerBrief):
    country: str
    note: str
    is_synthetic: bool
    created_at: datetime
    orders: list[OrderOut]
    previous_tickets: list[TicketBrief] = []


# ---- tickets
class MessageOut(ORM):
    id: int
    author_type: str
    author_name: str
    body: str
    is_internal: bool
    delivery: str
    created_at: datetime


class TicketListItem(ORM):
    id: int
    subject: str
    status: str
    priority: str
    category: str
    channel: str
    created_at: datetime
    updated_at: datetime
    is_synthetic: bool
    customer: CustomerBrief
    order_id: str | None
    preview: str = ""
    message_count: int = 0
    pending_approvals: int = 0


class TicketListOut(BaseModel):
    items: list[TicketListItem]
    total: int
    counts: dict[str, int]


class DraftOut(ORM):
    id: int
    ticket_id: int
    agent_run_id: int | None
    body: str
    original_body: str
    tone: str
    provider: str
    model: str
    citations: list[dict[str, Any]]
    validation: dict[str, Any]
    insufficient_evidence: bool
    confidence: str
    status: str
    created_at: datetime
    approved_at: datetime | None


class AgentStepOut(ORM):
    id: int
    ordinal: int
    node: str
    tool: str
    status: str
    summary: str
    input: dict[str, Any]
    output: dict[str, Any]
    attempts: int
    duration_ms: int
    started_at: datetime


class AgentRunOut(ORM):
    id: int
    ticket_id: int
    status: str
    decision: str
    decision_reason: str
    classification: dict[str, Any]
    final_state: dict[str, Any]
    provider: str
    error: str
    started_at: datetime
    finished_at: datetime | None
    steps: list[AgentStepOut]


class ApprovalOut(ORM):
    id: int
    ticket_id: int
    run_id: int | None
    draft_id: int | None
    kind: str
    summary: str
    payload: dict[str, Any]
    required_role: str
    status: str
    decision_note: str
    requested_at: datetime
    decided_at: datetime | None
    ticket_subject: str = ""


class TicketDetail(TicketListItem):
    escalation_reason: str
    first_response_at: datetime | None
    resolved_at: datetime | None
    messages: list[MessageOut]
    customer_profile: CustomerOut
    order: OrderOut | None
    drafts: list[DraftOut]
    latest_run: AgentRunOut | None
    approvals: list[ApprovalOut]


class TicketPatch(BaseModel):
    status: TicketStatus | None = None
    priority: Priority | None = None


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class EscalateIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class DraftRequest(BaseModel):
    tone: Tone = "empathetic"
    instructions: str = Field(default="", max_length=500)


class DraftEdit(BaseModel):
    body: str = Field(min_length=1, max_length=6000)


class AgentRunRequest(BaseModel):
    tone: Tone | None = None


class ApprovalDecision(BaseModel):
    decision: Literal["approve", "reject"]
    note: str = Field(default="", max_length=1000)
    final_body: str | None = Field(default=None, max_length=6000)


# ---- knowledge
class DocumentOut(ORM):
    id: int
    title: str
    filename: str
    mime: str
    size_bytes: int
    status: str
    error: str
    chunk_count: int
    page_count: int
    source: str
    embedding_model: str
    created_at: datetime
    indexed_at: datetime | None


class ChunkOut(ORM):
    id: str
    ordinal: int
    text: str
    section: str
    page: int | None


class DocumentDetail(DocumentOut):
    chunks: list[ChunkOut]


class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    k: int = Field(default=5, ge=1, le=10)


class PassageOut(BaseModel):
    chunk_id: str
    document_id: int
    document_title: str
    section: str
    page: int | None
    text: str
    score: float
    above_threshold: bool


class SearchOut(BaseModel):
    query: str
    threshold: float
    results: list[PassageOut]


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    tone: Tone = "professional"


class AskOut(BaseModel):
    answer: str
    citations: list[dict[str, Any]]
    validation: dict[str, Any]
    insufficient_evidence: bool
    confidence: str
    provider: str
    model: str
    retrieved: list[PassageOut]

