"use client";

import clsx from "clsx";
import { Check, Lock, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Approval } from "@/lib/types";
import { money, relativeTime } from "@/lib/format";
import { useUser } from "@/components/AppShell";
import { Badge, Button, Dialog, Field, Textarea, useToast } from "@/components/ui";

const KIND: Record<Approval["kind"], string> = { send_reply: "Send reply", refund: "Refund", return_label: "Return and refund" };

export function ApprovalCard({ approval, onDecided, showTicket }: { approval: Approval; onDecided: () => Promise<void> | void; showTicket?: boolean }) {
  const user = useUser();
  const toast = useToast();
  const [busy, setBusy] = useState<"" | "approve" | "reject">("");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const allowed = user?.role === "lead" || approval.required_role === "agent";
  const amount = typeof approval.payload.amount_cents === "number" ? approval.payload.amount_cents : null;
  const rules = Array.isArray(approval.payload.rule_ids) ? (approval.payload.rule_ids as string[]) : [];

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    try {
      await api(`/approvals/${approval.id}/decision`, { method: "POST", json: { decision, note } });
      setRejecting(false);
      toast(decision === "approve" ? `${KIND[approval.kind]} approved` : `${KIND[approval.kind]} rejected`);
      await onDecided();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't record the decision.", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <article className={clsx("rounded-[10px] border bg-paper p-3.5", approval.status === "pending" ? "border-amber/35" : "border-rule")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">{approval.summary}</p>
          {showTicket && (
            <Link href={`/app/inbox?t=${approval.ticket_id}`} className="mt-0.5 block truncate text-[12.5px] text-cobalt hover:underline">
              #{approval.ticket_id} {approval.ticket_subject}
            </Link>
          )}
        </div>
        {amount !== null && <span className="tabular shrink-0 font-display text-[1.05rem] text-ink">{money(amount)}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <Badge tone={approval.status === "pending" ? "amber" : approval.status === "approved" ? "moss" : "neutral"}>
          {approval.status === "pending" ? "Pending" : approval.status === "approved" ? "Approved" : "Rejected"}
        </Badge>
        {approval.required_role === "lead" && <Badge tone="ink">Team lead</Badge>}
        {rules.map((r) => <Badge key={r} tone="cobalt">{r}</Badge>)}
        <span className="text-ink-faint">{relativeTime(approval.decided_at ?? approval.requested_at)}</span>
      </div>
      {approval.decision_note && <p className="mt-2 text-[12.5px] text-ink-soft">Note: {approval.decision_note}</p>}
      {approval.kind !== "send_reply" && approval.status === "pending" && (
        <p className="mt-2 text-[12px] leading-snug text-ink-faint">Approving records the decision for your payment system. SupportIQ doesn’t move money.</p>
      )}
      {approval.status === "pending" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {allowed ? (
            <>
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} loading={busy === "approve"} onClick={() => void decide("approve")}>Approve</Button>
              <Button size="sm" icon={<X className="size-3.5" />} onClick={() => setRejecting(true)}>Reject</Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft"><Lock className="size-3.5" aria-hidden /> Only a team lead can decide this</span>
          )}
        </div>
      )}
      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Reject: ${approval.summary}`}
        description="Add a short reason for the audit trail. The customer won't see it."
        footer={
          <>
            <Button onClick={() => setRejecting(false)}>Cancel</Button>
            <Button variant="danger" loading={busy === "reject"} onClick={() => void decide("reject")}>Reject</Button>
          </>
        }
      >
        <Field label="Reason" htmlFor={`reason-${approval.id}`}>
          <Textarea id={`reason-${approval.id}`} data-autofocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </Dialog>
    </article>
  );
}
