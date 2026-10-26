"use client";

import clsx from "clsx";
import { ArrowLeft, Bot, CheckCircle2, Flag, Lock, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, useResource } from "@/lib/api";
import type { AgentRun, Priority, TicketDetail } from "@/lib/types";
import { dateTime, humanize } from "@/lib/format";
import { useUser } from "@/components/AppShell";
import { Avatar, Badge, Button, Dialog, ErrorState, Field, Kbd, PriorityMark, Skeleton, StatusBadge, Textarea, useToast } from "@/components/ui";
import { ContextPanel } from "./ContextPanel";
import { DraftComposer } from "./DraftComposer";

function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

export function TicketWorkspace({ id, onBack, onListChanged }: { id: number; onBack: () => void; onListChanged: () => void }) {
  const res = useResource<TicketDetail>(`/tickets/${id}`);
  const user = useUser();
  const toast = useToast();
  const [view, setView] = useState<"conversation" | "context">("conversation");
  const [running, setRunning] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const t = res.data;

  const refresh = async () => {
    await res.reload();
    onListChanged();
  };

  async function runAgent() {
    if (!t || running) return;
    setRunning(true);
    try {
      const run = await api<AgentRun>(`/tickets/${t.id}/agent-runs`, { method: "POST", json: {} });
      await refresh();
      setView("context");
      toast(run.status === "escalated" ? "Agent escalated this ticket to a team lead" : run.status === "failed" ? "Agent run failed; see the activity trail" : "Agent finished: review the draft and approvals");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The agent run failed.", "error");
    } finally {
      setRunning(false);
    }
  }

  async function patch(body: { status?: string; priority?: Priority }) {
    setBusy(true);
    try {
      const d = await api<TicketDetail>(`/tickets/${id}`, { method: "PATCH", json: body });
      res.setData(d);
      onListChanged();
      if (body.status) toast(body.status === "resolved" ? "Ticket resolved" : `Ticket moved to ${humanize(body.status)}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    setBusy(true);
    try {
      const d = await api<TicketDetail>(`/tickets/${id}/escalate`, { method: "POST", json: { reason } });
      res.setData(d);
      setEscalating(false);
      setReason("");
      onListChanged();
      toast("Escalated to a team lead");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't escalate.", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "r") { e.preventDefault(); void runAgent(); }
      if (e.key === "e") { e.preventDefault(); setEscalating(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (res.error && !t) return <div className="p-6"><ErrorState message={res.error.message} onRetry={() => void res.reload()} /></div>;
  if (!t) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const resolvedLocked = t.status === "escalated" && user?.role !== "lead";
  const visible = t.messages;

  const conversation = (
    <div className="space-y-6">
      {t.status === "escalated" && t.escalation_reason && (
        <div className="flex gap-2.5 rounded-[10px] border border-brick/25 bg-brick-wash/60 p-3 text-[13px]">
          <Flag className="mt-0.5 size-4 shrink-0 text-brick" aria-hidden />
          <div><p className="font-medium text-ink">Escalated</p><p className="text-ink-soft">{t.escalation_reason}</p></div>
        </div>
      )}
      <ol className="space-y-4" aria-label="Conversation">
        {visible.map((m) => (
          <li key={m.id} className={clsx("flex gap-3", m.author_type === "agent" && !m.is_internal && "flex-row-reverse")}>
            {m.author_type !== "system" && <Avatar name={m.author_name} className="mt-1 size-8 text-[12px]" />}
            <div className={clsx(
              "max-w-[min(100%,620px)] rounded-[12px] px-4 py-3",
              m.is_internal ? (m.author_type === "system" ? "w-full border border-dashed border-rule-strong bg-transparent text-[13px]" : "border border-amber/30 bg-amber-wash/60")
                : m.author_type === "customer" ? "border border-rule bg-paper" : "bg-ink text-paper",
            )}>
              <div className={clsx("mb-1 flex flex-wrap items-center gap-x-2 text-[12px]", m.author_type === "agent" && !m.is_internal ? "text-paper/60" : "text-ink-faint")}>
                <span className={clsx("font-medium", m.author_type === "agent" && !m.is_internal ? "text-paper/90" : "text-ink-soft")}>{m.author_name}</span>
                <span>{dateTime(m.created_at)}</span>
                {m.is_internal && m.author_type !== "system" && <span className="text-amber">Internal note</span>}
                {m.delivery === "simulated" && <span title="No email integration is configured; the reply was recorded, not emailed.">Recorded, not emailed</span>}
              </div>
              <p className={clsx("leading-relaxed whitespace-pre-line", m.is_internal && m.author_type === "system" ? "text-ink-soft" : "text-[14.5px]")}>{m.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <DraftComposer ticket={t} onChanged={refresh} />
    </div>
  );

  return (
    <article className="flex h-full min-h-0 flex-col" aria-label={`Ticket ${t.id}`}>
      <header className="border-b border-rule bg-ivory px-4 py-3 sm:px-6">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onBack} className="-ml-1 rounded-md p-1.5 text-ink-soft hover:bg-ivory-deep md:hidden" aria-label="Back to ticket list">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-ink-faint">
              #{t.id} from {t.customer.name} via {t.channel}{t.order_id ? `, order ${t.order_id}` : ""}
            </p>
            <h2 className="font-display mt-0.5 text-[1.45rem] leading-tight text-ink sm:text-[1.6rem]">{t.subject}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={t.status} />
              <label className="inline-flex items-center gap-1.5">
                <PriorityMark priority={t.priority} />
                <span className="sr-only">Priority</span>
                <select value={t.priority} disabled={busy} onChange={(e) => void patch({ priority: e.target.value as Priority })}
                  className="h-7 rounded-[6px] border border-rule bg-paper px-1.5 text-[12.5px] text-ink-soft capitalize">
                  {["urgent", "high", "normal", "low"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              {t.category !== "uncategorized" && <Badge>{humanize(t.category)}</Badge>}
              {t.is_synthetic && <Badge tone="amber">Synthetic</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" icon={<Bot className="size-4" />} loading={running} disabled={t.status === "resolved"} onClick={() => void runAgent()}>
            {running ? "Running workflow" : t.latest_run ? "Run agent again" : "Run agent"}
          </Button>
          {t.status !== "escalated" && t.status !== "resolved" && (
            <Button size="sm" icon={<Flag className="size-3.5" />} onClick={() => setEscalating(true)}>Escalate</Button>
          )}
          {t.status === "resolved" ? (
            <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={busy} onClick={() => void patch({ status: "open" })}>Reopen</Button>
          ) : (
            <Button size="sm" icon={resolvedLocked ? <Lock className="size-3.5" /> : <CheckCircle2 className="size-3.5" />} disabled={resolvedLocked} loading={busy}
              title={resolvedLocked ? "Escalated tickets are resolved by a team lead" : undefined} onClick={() => void patch({ status: "resolved" })}>
              Mark resolved
            </Button>
          )}
          <span className="ml-auto hidden items-center gap-1.5 text-[12px] text-ink-faint lg:flex"><Kbd>r</Kbd> run agent <Kbd>e</Kbd> escalate</span>
        </div>
        {running && <p className="mt-2 text-[12.5px] text-ink-soft" role="status">Classifying, looking up the order, searching policies, checking rules and drafting. This usually takes a few seconds.</p>}
        <div role="tablist" aria-label="Ticket view" className="mt-3 flex gap-1 xl:hidden">
          {(["conversation", "context"] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
              className={clsx("h-8 rounded-[6px] px-3 text-[13px]", view === v ? "bg-paper font-medium text-ink shadow-[var(--shadow-lift)]" : "text-ink-soft")}>
              {v === "conversation" ? "Conversation" : `Customer & agent${t.approvals.some((a) => a.status === "pending") ? " (action needed)" : ""}`}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={clsx("scroll-quiet min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6", view !== "conversation" && "hidden xl:block")}>{conversation}</div>
        <aside aria-label="Customer and agent context" className={clsx("scroll-quiet w-full overflow-y-auto border-l border-rule bg-ivory px-4 py-6 sm:px-6 xl:block xl:w-[360px] xl:shrink-0 xl:px-5", view !== "context" && "hidden")}>
          <ContextPanel ticket={t} onChanged={refresh} />
        </aside>
      </div>

      <Dialog
        open={escalating}
        onClose={() => setEscalating(false)}
        title="Escalate to a team lead"
        description="The ticket moves to the Escalated queue and only a lead can approve replies or resolve it."
        footer={
          <>
            <Button onClick={() => setEscalating(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={reason.trim().length < 3} onClick={() => void escalate()}>Escalate</Button>
          </>
        }
      >
        <Field label="What does the lead need to know?" htmlFor="esc-reason" hint="Saved as an internal note.">
          <Textarea id="esc-reason" data-autofocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
      </Dialog>
    </article>
  );
}
