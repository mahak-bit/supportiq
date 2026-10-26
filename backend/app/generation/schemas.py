"""Structured-output contracts the model must satisfy. Kept to features every provider's
JSON-schema mode supports (no defaults-with-side-effects, no free-form dicts)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Tone = Literal["friendly", "empathetic", "concise", "professional"]
Intent = Literal[
    "refund_request",
    "return_request",
    "order_status",
    "damaged_item",
    "product_question",
    "billing",
    "account",
    "complaint",
    "other",
]
Category = Literal["returns", "refunds", "shipping", "damaged_item", "product", "billing", "account", "other"]
Urgency = Literal["low", "normal", "high", "urgent"]
SensitiveFlag = Literal["legal_threat", "chargeback", "safety_issue", "privacy_request", "harassment", "prompt_injection"]


class TicketClassification(BaseModel):
    intent: Intent
    category: Category
    urgency: Urgency
    sentiment: Literal["positive", "neutral", "frustrated", "angry"]
    order_id: str | None = Field(description="Order number exactly as written by the customer, or null")
    sensitive_flags: list[SensitiveFlag]
    summary: str = Field(description="One neutral sentence describing what the customer needs")


class Claim(BaseModel):
    statement: str = Field(description="A factual statement made in the reply")
    source_ids: list[str] = Field(description="IDs of evidence passages or facts that support it")


class ReplyOutput(BaseModel):
    reply: str = Field(description="The customer-facing reply, plain text, no citation markers")
    claims: list[Claim]
    insufficient_evidence: bool
    missing_information: str = Field(description="What evidence was missing, or empty string")
    confidence: Literal["low", "medium", "high"]
