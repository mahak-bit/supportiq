"use client";

import clsx from "clsx";
import { MapPin, Package } from "lucide-react";
import Link from "next/link";
import type { TicketDetail } from "@/lib/types";
import { humanize, money, shortDate } from "@/lib/format";
import { ApprovalCard } from "@/components/ApprovalCard";
import { Avatar, Badge, SectionTitle, StatusBadge } from "@/components/ui";
import { AgentTimeline } from "./AgentTimeline";

export function ContextPanel({ ticket, onChanged }: { ticket: TicketDetail; onChanged: () => Promise<void> }) {
  const c = ticket.customer_profile;
  const pending = ticket.approvals.filter((a) => a.status === "pending");
  const decided = ticket.approvals.filter((a) => a.status !== "pending").slice(0, 4);
  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section aria-labelledby="ap-title">
          <SectionTitle id="ap-title">Waiting for your decision</SectionTitle>
          <div className="space-y-2">{pending.map((a) => <ApprovalCard key={a.id} approval={a} onDecided={onChanged} />)}</div>
        </section>
      )}

      <section aria-labelledby="agent-title">
        <SectionTitle id="agent-title">Agent activity</SectionTitle>
        {ticket.latest_run ? (
          <AgentTimeline run={ticket.latest_run} />
        ) : (
          <p className="text-[13px] text-fg-faint">The agent hasn’t run on this ticket yet. Use “Run agent” to classify it, check the order and rules, and draft a reply.</p>
        )}
      </section>

      <section aria-labelledby="cust-title">
        <SectionTitle id="cust-title">Customer</SectionTitle>
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-fg">{c.name}</p>
            <p className="truncate text-[12.5px] text-fg-soft">{c.email}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tier === "plus" && <Badge tone="cobalt">Halden Plus</Badge>}
          <Badge><MapPin className="size-3" aria-hidden />{c.country}</Badge>
          {c.is_synthetic && <Badge tone="amber">Synthetic</Badge>}
        </div>
        {c.note && <p className="mt-2 text-[12.5px] text-fg-soft">{c.note}</p>}
      </section>

      <section aria-labelledby="orders-title">
        <SectionTitle id="orders-title">Orders</SectionTitle>
        {c.orders.length === 0 ? (
          <p className="text-[13px] text-fg-faint">No orders on file.</p>
        ) : (
          <ul className="space-y-2">
            {c.orders.map((o) => (
              <li key={o.id} className={clsx("rounded-[9px] border bg-surface p-3 text-[12.5px]", o.id === ticket.order_id ? "border-accent/40" : "border-line")}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-fg"><Package className="size-3.5 text-fg-faint" aria-hidden />{o.id}</span>
                  <span className="tabular text-fg">{money(o.total_cents, o.currency)}</span>
                </div>
                <p className="mt-1 text-fg-soft">
                  {humanize(o.status)}. Placed {shortDate(o.placed_at)}{o.delivered_at ? `, delivered ${shortDate(o.delivered_at)}` : ""}.
                </p>
                <p className="mt-1 text-fg-faint">
                  {o.items.map((i) => i.name + (i.final_sale ? " (final sale)" : "")).join(", ")}
                </p>
                {o.id === ticket.order_id && <p className="mt-1.5 text-[11.5px] font-medium text-accent">Linked to this ticket</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-title">
        <SectionTitle id="hist-title">Previous tickets</SectionTitle>
        {c.previous_tickets.length === 0 ? (
          <p className="text-[13px] text-fg-faint">First conversation with this customer.</p>
        ) : (
          <ul className="space-y-1">
            {c.previous_tickets.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link href={`/app/inbox?t=${t.id}&status=all`} className="flex items-center justify-between gap-2 rounded-[7px] px-2 py-1.5 text-[13px] hover:bg-well">
                  <span className="truncate text-fg">{t.subject}</span>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section aria-labelledby="dec-title">
          <SectionTitle id="dec-title">Decision history</SectionTitle>
          <div className="space-y-2">{decided.map((a) => <ApprovalCard key={a.id} approval={a} onDecided={onChanged} />)}</div>
        </section>
      )}
    </div>
  );
}
