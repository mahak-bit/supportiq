"""Analytics computed live from the database. Nothing here is hard-coded: if the data is
synthetic (seeded), the response says so and reports how many records are synthetic."""

from __future__ import annotations

import statistics
from collections import Counter
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.models import AgentRun, ApprovalRequest, Draft, Ticket, User
from app.security import current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _median(xs: list[float]) -> float | None:
    return round(statistics.median(xs), 1) if xs else None


@router.get("/summary")
def summary(days: int = Query(30, ge=7, le=90), db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    now = utcnow()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    tickets = list(db.scalars(select(Ticket)))
    window = [t for t in tickets if t.created_at >= start]

    created = Counter(t.created_at.date().isoformat() for t in window)
    resolved = Counter(t.resolved_at.date().isoformat() for t in tickets if t.resolved_at and t.resolved_at >= start)
    series = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        series.append({"date": d, "created": created.get(d, 0), "resolved": resolved.get(d, 0)})

    frt = [(t.first_response_at - t.created_at).total_seconds() / 60 for t in window if t.first_response_at]
    ttr = [(t.resolved_at - t.created_at).total_seconds() / 3600 for t in window if t.resolved_at]

    by_cat: dict[str, dict] = {}
    for t in window:
        c = by_cat.setdefault(t.category, {"category": t.category, "count": 0, "resolution_hours": []})
        c["count"] += 1
        if t.resolved_at:
            c["resolution_hours"].append((t.resolved_at - t.created_at).total_seconds() / 3600)
    categories = sorted(({"category": c["category"], "count": c["count"], "median_resolution_hours": _median(c["resolution_hours"])}
                         for c in by_cat.values()), key=lambda c: -c["count"])

    runs = list(db.scalars(select(AgentRun)))
    approvals = list(db.scalars(select(ApprovalRequest)))
    sent = list(db.scalars(select(Draft).where(Draft.status == "sent")))
    drafts_all = list(db.scalars(select(Draft)))
    validated = [d for d in drafts_all if d.validation]

    return {
        "window_days": days,
        "generated_at": now.isoformat(),
        "provenance": {
            "tickets_total": len(tickets),
            "tickets_synthetic": sum(t.is_synthetic for t in tickets),
            "note": "Ticket metrics are calculated live from the database. Seeded tickets are synthetic sample data; "
                    "agent and approval metrics reflect actions taken in this workspace.",
        },
        "totals": {
            "created": len(window),
            "resolved": sum(1 for t in window if t.resolved_at),
            "open_now": sum(1 for t in tickets if t.status != "resolved"),
            "escalated_now": sum(1 for t in tickets if t.status == "escalated"),
            "median_first_response_minutes": _median(frt),
            "median_resolution_hours": _median(ttr),
        },
        "series": series,
        "categories": categories,
        "priorities": dict(Counter(t.priority for t in tickets if t.status != "resolved")),
        "agent": {
            "runs": len(runs),
            "decisions": dict(Counter(r.decision or r.status for r in runs)),
            "approvals": dict(Counter(f"{a.kind}:{a.status}" for a in approvals)),
            "drafts_generated": len(drafts_all),
            "drafts_sent": len(sent),
            "drafts_edited_before_send": sum(1 for d in sent if d.body.strip() != d.original_body.strip()),
            "validation_pass_rate": round(sum(1 for d in validated if d.validation.get("passed")) / len(validated), 3) if validated else None,
            "insufficient_evidence_drafts": sum(1 for d in drafts_all if d.insufficient_evidence),
        },
    }
