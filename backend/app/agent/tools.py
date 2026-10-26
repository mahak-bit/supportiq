"""The agent's permitted tools. Each has typed input and output models. None of them can
send messages, move money or modify orders: consequential actions are only *proposed*
as ApprovalRequests for a human to decide."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agent.rules import Eligibility, OrderFacts, check_eligibility
from app.models import Customer, Order
from app.rag.retriever import retrieve


class OrderLookupInput(BaseModel):
    order_id: str = Field(pattern=r"^HC-\d{5}$")
    customer_id: int


class OrderLookupOutput(BaseModel):
    found: bool
    order: OrderFacts | None = None
    reason: str = ""


def lookup_order(db: Session, inp: OrderLookupInput) -> OrderLookupOutput:
    order = db.get(Order, inp.order_id)
    if order is None:
        return OrderLookupOutput(found=False, reason=f"No order {inp.order_id} exists in the order database.")
    if order.customer_id != inp.customer_id:
        # Do not leak another customer's order details.
        return OrderLookupOutput(found=False, reason=f"Order {inp.order_id} does not belong to this customer.")
    customer = db.get(Customer, order.customer_id)
    return OrderLookupOutput(
        found=True,
        order=OrderFacts(
            id=order.id, status=order.status, placed_at=order.placed_at, delivered_at=order.delivered_at,
            total_cents=order.total_cents, refunded_cents=order.refunded_cents, currency=order.currency,
            items=order.items, payment_method=order.payment_method, customer_tier=customer.tier if customer else "standard",
        ),
    )


class KBSearchInput(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    k: int = Field(default=5, ge=1, le=10)


class KBPassage(BaseModel):
    chunk_id: str
    document_id: int
    document_title: str
    section: str
    page: int | None
    text: str
    score: float


class KBSearchOutput(BaseModel):
    passages: list[KBPassage]


def search_knowledge_base(db: Session, inp: KBSearchInput) -> KBSearchOutput:
    return KBSearchOutput(passages=[KBPassage(**p.to_dict()) for p in retrieve(db, inp.query, inp.k)])


class EligibilityInput(BaseModel):
    order: OrderFacts
    intent: str
    as_of: datetime


def eligibility_tool(inp: EligibilityInput) -> Eligibility:
    return check_eligibility(inp.order, inp.intent, inp.as_of)
