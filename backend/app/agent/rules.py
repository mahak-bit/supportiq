"""Explicit, deterministic business rules for returns and refunds.

These mirror the seeded "Returns & Refunds Policy" document section by section. The model
never decides eligibility: it only explains the outcome computed here."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.config import get_settings

RETURN_WINDOW_DAYS = 30
PLUS_RETURN_WINDOW_DAYS = 45
DAMAGE_REPORT_WINDOW_DAYS = 14
LOST_PACKAGE_DAYS = 14

Action = Literal["cancel_and_refund", "return_for_refund", "replacement_or_refund", "investigate_shipment", "none"]


class OrderFacts(BaseModel):
    id: str
    status: str
    placed_at: datetime
    delivered_at: datetime | None
    total_cents: int
    refunded_cents: int
    currency: str
    items: list[dict]
    payment_method: str
    customer_tier: str


class Eligibility(BaseModel):
    eligible: bool
    action: Action
    rule_ids: list[str]
    reasons: list[str]
    amount_cents: int
    window_days: int | None = None
    days_since_delivery: int | None = None
    requires_lead_approval: bool = False
    customer_text: str  # neutral phrasing safe to put in a draft for human review


def _money(cents: int, currency: str) -> str:
    return f"{currency} {cents / 100:,.2f}" if currency != "USD" else f"${cents / 100:,.2f}"


def check_eligibility(order: OrderFacts, intent: str, now: datetime) -> Eligibility:
    s = get_settings()
    remaining = order.total_cents - order.refunded_cents
    final_sale = [i["name"] for i in order.items if i.get("final_sale")]

    def result(eligible: bool, action: Action, rules: list[str], reasons: list[str], text: str, **kw) -> Eligibility:
        amount = remaining if eligible and action != "investigate_shipment" else 0
        return Eligibility(
            eligible=eligible, action=action, rule_ids=rules, reasons=reasons, amount_cents=amount,
            requires_lead_approval=amount > s.refund_lead_approval_threshold_cents, customer_text=text, **kw,
        )

    if order.status == "cancelled":
        return result(False, "none", ["RR-0"], ["Order is already cancelled."],
                      f"Order {order.id} has already been cancelled.")
    if remaining <= 0:
        return result(False, "none", ["RR-0"], ["Order has already been fully refunded."],
                      f"Our records show order {order.id} has already been refunded in full.")
    if order.status == "processing":
        return result(True, "cancel_and_refund", ["RR-4"], ["Order has not shipped yet, so it can be cancelled."],
                      f"Order {order.id} hasn't shipped yet, so it can be cancelled for a full refund of {_money(remaining, order.currency)} once our team confirms.")
    if order.status == "shipped" or order.delivered_at is None:
        days_out = (now - order.placed_at).days
        if days_out >= LOST_PACKAGE_DAYS:
            return result(False, "investigate_shipment", ["RR-5"],
                          [f"Shipped {days_out} days ago and still not delivered: lost-package investigation required."],
                          f"Order {order.id} was placed {days_out} days ago and hasn't been marked delivered, so our team will open a carrier investigation.")
        return result(False, "none", ["RR-5"], ["Order is in transit; refunds apply after delivery or a lost-package finding."],
                      f"Order {order.id} is currently in transit.")

    days = (now - order.delivered_at).days
    if intent == "damaged_item":
        if days <= DAMAGE_REPORT_WINDOW_DAYS:
            return result(True, "replacement_or_refund", ["RR-3"],
                          [f"Damage reported {days} days after delivery (limit {DAMAGE_REPORT_WINDOW_DAYS})."],
                          f"Because the damage was reported within {DAMAGE_REPORT_WINDOW_DAYS} days of delivery, order {order.id} qualifies for a free replacement or a full refund, with no return shipping cost.",
                          window_days=DAMAGE_REPORT_WINDOW_DAYS, days_since_delivery=days)
        return result(False, "none", ["RR-3"],
                      [f"Damage reported {days} days after delivery, beyond the {DAMAGE_REPORT_WINDOW_DAYS}-day reporting window."],
                      f"Damage reports need to reach us within {DAMAGE_REPORT_WINDOW_DAYS} days of delivery, and order {order.id} was delivered {days} days ago.",
                      window_days=DAMAGE_REPORT_WINDOW_DAYS, days_since_delivery=days)

    window = PLUS_RETURN_WINDOW_DAYS if order.customer_tier == "plus" else RETURN_WINDOW_DAYS
    rules = ["RR-1", "RR-8"] if order.customer_tier == "plus" else ["RR-1"]
    if final_sale:
        return result(False, "none", rules + ["RR-2"], [f"Final-sale items cannot be returned: {', '.join(final_sale)}."],
                      f"Order {order.id} includes final-sale items ({', '.join(final_sale)}), which can't be returned unless they arrived damaged or defective.",
                      window_days=window, days_since_delivery=days)
    if days <= window:
        return result(True, "return_for_refund", rules + ["RR-6"],
                      [f"Delivered {days} days ago, within the {window}-day return window."],
                      f"Order {order.id} was delivered {days} days ago, which is within our {window}-day return window, so it's eligible for a return. The refund of {_money(remaining, order.currency)} goes back to the original payment method once the return is received.",
                      window_days=window, days_since_delivery=days)
    return result(False, "none", rules, [f"Delivered {days} days ago, outside the {window}-day return window."],
                  f"Order {order.id} was delivered {days} days ago, which is outside our {window}-day return window.",
                  window_days=window, days_since_delivery=days)
