"use client";

import clsx from "clsx";
import { Check, Copy, Lock, RefreshCw, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Draft, Message, TicketDetail, Tone } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { useUser } from "@/components/AppShell";
import { Badge, Button, Dialog, ErrorState, Segmented, Textarea, useToast } from "@/components/ui";
import { CitationList, ValidationReport } from "./Citations";

const TONES: { value: Tone; label: string }[] = [
  { value: "empathetic", label: "Empathetic" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "professional", label: "Professional" },
];

export function DraftComposer({ ticket, onChanged }: { ticket: TicketDetail; onChanged: () => Promise<void> }) {
  const user = useUser();
  const toast = useToast();
  const draft = ticket.drafts.find((d) => d.status === "draft") ?? null;
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [tone, setTone] = useState<Tone>(draft?.tone ?? "empathetic");
  const [body, setBody] = useState(draft?.body ?? "");
  const [guidance, setGuidance] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "generate" | "send" | "note" | "discard">("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    setBody(draft?.body ?? "");
    if (draft) setTone(draft.tone);
  }, [draft?.id]);

  const needsLead = ticket.status === "escalated" || ticket.approvals.some((a) => a.draft_id === draft?.id && a.status === "pending" && a.required_role === "lead");
  const blocked = needsLead && user?.role !== "lead";
  const resolved = ticket.status === "resolved";

  async function generate() {
    setBusy("generate");
    setError("");
    try {
      await api<Draft>(`/tickets/${ticket.id}/drafts`, { method: "POST", json: { tone, instructions: guidance } });
      await onChanged();
      toast(draft ? "Draft regenerated" : "Draft ready for review");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't generate a draft.");
    } finally {
      setBusy("");
    }
  }

  async function saveEdit() {
    if (!draft || body === draft.body || !body.trim()) return;
    try {
      await api(`/drafts/${draft.id}`, { method: "PATCH", json: { body } });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save your edit.", "error");
    }
  }

  async function send() {
    if (!draft) return;
    setBusy("send");
    try {
      await api<Message>(`/drafts/${draft.id}/send`, { method: "POST", json: { body } });
      setConfirm(false);
      await onChanged();
      toast("Reply approved and recorded on the ticket");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't send the reply.", "error");
    } finally {
      setBusy("");
    }
  }

  async function discard() {
    if (!draft) return;
    setBusy("discard");
    try {
      await api(`/drafts/${draft.id}/discard`, { method: "POST" });
      await onChanged();
      toast("Draft discarded");
    } finally {
      setBusy("");
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy("note");
    try {
      await api(`/tickets/${ticket.id}/notes`, { method: "POST", json: { body: note } });
      setNote("");
      await onChanged();
      toast("Internal note added");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't add the note.", "error");
    } finally {
      setBusy("");
    }
  }

  const edited = draft && body.trim() !== draft.original_body.trim();
  const extractive = draft?.provider === "extractive";

  return (
    <section aria-label="Reply" className="rounded-[var(--radius-panel)] border border-rule bg-paper shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <div role="tablist" aria-label="Composer mode" className="flex gap-1">
          {(["reply", "note"] as const).map((m) => (
            <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => setMode(m)}
              className={clsx("inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[13px] whitespace-nowrap", mode === m ? "bg-ivory-deep font-medium text-ink" : "text-ink-soft hover:text-ink")}>
              {m === "reply" ? <Sparkles className="size-3.5" aria-hidden /> : <StickyNote className="size-3.5" aria-hidden />}
              {m === "reply" ? "Suggested reply" : "Internal note"}
            </button>
          ))}
        </div>
        {mode === "reply" && draft && (
          <span className="hidden truncate text-[12px] text-ink-faint 2xl:inline">Drafted {relativeTime(draft.created_at)} by {extractive ? "extractive mode" : draft.model}</span>
        )}
      </div>

      {mode === "note" ? (
        <div className="space-y-3 p-4">
          <label htmlFor="note" className="sr-only">Internal note</label>
          <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to your team only. The customer never sees notes." />
          <div className="flex justify-end"><Button variant="primary" size="sm" loading={busy === "note"} disabled={!note.trim()} onClick={() => void addNote()}>Add note</Button></div>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Tone" size="sm" value={tone} options={TONES} onChange={setTone} />
            <Button size="sm" variant={draft ? "secondary" : "primary"} icon={draft ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
              loading={busy === "generate"} disabled={resolved} onClick={() => void generate()}>
              {draft ? "Regenerate" : "Draft a reply"}
            </Button>
          </div>
          <input
            aria-label="Guidance for the draft (optional)"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            maxLength={500}
            placeholder="Optional guidance, e.g. “offer the replacement first”"
            className="h-8.5 w-full rounded-[6px] border border-rule bg-ivory/50 px-3 text-[13px] placeholder:text-ink-faint focus:border-cobalt focus:outline-none"
          />
          {error && <ErrorState message={error} onRetry={() => void generate()} compact />}

          {draft ? (
            <>
              {extractive && (
                <p className="rounded-[8px] bg-ivory-deep px-3 py-2 text-[12.5px] text-ink-soft">
                  No language model is configured, so this draft quotes sentences from the sources and verified records directly.
                  Add a Gemini key or run Ollama for written replies (see Settings).
                </p>
              )}
              <div>
                <label htmlFor="draft-body" className="mb-1.5 flex items-center justify-between text-[12.5px] text-ink-faint">
                  <span>Edit before approving</span>
                  {edited && <Badge tone="cobalt">Edited</Badge>}
                </label>
                <Textarea id="draft-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => void saveEdit()} disabled={resolved} className="text-[14.5px]" />
              </div>
              <ValidationReport validation={draft.validation} insufficient={draft.insufficient_evidence} />
              {draft.citations.length > 0 && (
                <div>
                  <p className="mb-2 text-[12.5px] font-medium text-ink">Sources behind this draft</p>
                  <CitationList citations={draft.citations} />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4">
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" />} onClick={() => void navigator.clipboard.writeText(body).then(() => toast("Copied to clipboard"))}>Copy</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} loading={busy === "discard"} onClick={() => void discard()}>Discard</Button>
                </div>
                <div className="flex items-center gap-2">
                  {blocked && <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft"><Lock className="size-3" aria-hidden /> Needs a team lead</span>}
                  <Button variant="primary" icon={<Check className="size-4" />} disabled={blocked || !body.trim() || resolved} onClick={() => setConfirm(true)}>
                    Approve and send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-[13.5px] text-ink-soft">
              {resolved ? "This ticket is resolved. Reopen it to reply." : "Draft a grounded reply, or run the agent to also check the order and business rules."}
            </p>
          )}
        </div>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Approve this reply?"
        description="This demo has no email integration. Approving records the reply on the ticket as sent, marks it approved by you, and moves the ticket to awaiting customer."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Keep editing</Button>
            <Button variant="primary" data-autofocus loading={busy === "send"} onClick={() => void send()}>Approve and send</Button>
          </>
        }
      >
        <p className="scroll-quiet max-h-48 overflow-auto rounded-[8px] bg-ivory p-3 text-[13.5px] leading-relaxed whitespace-pre-line text-ink">{body}</p>
      </Dialog>
    </section>
  );
}
