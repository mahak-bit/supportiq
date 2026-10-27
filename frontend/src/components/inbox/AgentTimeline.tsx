"use client";

import clsx from "clsx";
import { ChevronDown, CircleAlert, CircleCheck, CircleDashed, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { AgentRun, AgentStep } from "@/lib/types";
import { dateTime, humanize } from "@/lib/format";
import { Badge } from "@/components/ui";

const NODE_LABEL: Record<string, string> = {
  load_context: "Loaded the ticket",
  classify: "Classified the request",
  plan_tools: "Chose tools",
  lookup_order: "Looked up the order",
  search_kb: "Searched the knowledge base",
  check_eligibility: "Checked business rules",
  draft_reply: "Drafted a reply",
  decide: "Made a recommendation",
};

const RUN_STATUS: Record<AgentRun["status"], { label: string; tone: "amber" | "brick" | "moss" | "neutral" }> = {
  running: { label: "Running", tone: "neutral" },
  awaiting_approval: { label: "Awaiting approval", tone: "amber" },
  escalated: { label: "Escalated to lead", tone: "brick" },
  completed: { label: "Completed", tone: "moss" },
  failed: { label: "Failed", tone: "brick" },
};

/** Audit trail of an agent run: what was called, with what, and what came back. */
export function AgentTimeline({ run }: { run: AgentRun }) {
  const c = run.classification;
  const status = RUN_STATUS[run.status];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="text-[12px] text-fg-faint">Run #{run.id}, {dateTime(run.started_at)}</span>
      </div>

      {c.intent && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[9px] border border-line bg-surface p-3 text-[12.5px]">
          <div><dt className="text-fg-faint">Intent</dt><dd className="text-fg">{humanize(c.intent)}</dd></div>
          <div><dt className="text-fg-faint">Urgency</dt><dd className="text-fg capitalize">{c.urgency}</dd></div>
          <div><dt className="text-fg-faint">Sentiment</dt><dd className="text-fg capitalize">{c.sentiment}</dd></div>
          <div><dt className="text-fg-faint">Classified by</dt><dd className="text-fg">{c.method}</dd></div>
          {!!c.sensitive_flags?.length && (
            <div className="col-span-2">
              <dt className="text-fg-faint">Signals</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {c.sensitive_flags.map((f) => <Badge key={f} tone="brick"><ShieldAlert className="size-3" aria-hidden />{humanize(f)}</Badge>)}
              </dd>
            </div>
          )}
        </dl>
      )}

      <ol className="relative space-y-0">
        {run.steps.map((s, i) => <Step key={s.id} step={s} last={i === run.steps.length - 1} />)}
      </ol>

      {run.decision_reason && (
        <div className={clsx("rounded-[9px] border p-3 text-[13px]", run.status === "escalated" ? "border-brick/25 bg-brick-wash/50" : "border-line bg-surface")}>
          <p className="font-medium text-fg">{run.status === "escalated" ? "Why it was escalated" : "Recommendation"}</p>
          <p className="mt-1 text-fg-soft">{run.decision_reason}</p>
        </div>
      )}
      {run.error && <p className="text-[12.5px] text-brick">{run.error}</p>}
      <p className="text-[11.5px] leading-snug text-fg-faint">
        This is a record of tool calls and their results, not the model’s private reasoning. Model: {run.provider}.
      </p>
    </div>
  );
}

function Step({ step, last }: { step: AgentStep; last: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = step.status === "ok" ? CircleCheck : step.status === "error" ? CircleAlert : CircleDashed;
  const hasDetail = Object.keys(step.input).length > 0 || Object.keys(step.output).length > 0;
  return (
    <li className="relative grid grid-cols-[1.5rem_1fr] gap-2.5 pb-4">
      {!last && <span className="absolute top-6 bottom-0 left-[11px] w-px bg-line-strong" aria-hidden />}
      <Icon className={clsx("relative mt-0.5 size-[22px] bg-canvas", step.status === "ok" ? "text-moss" : step.status === "error" ? "text-brick" : "text-fg-faint")} aria-hidden strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13.5px] font-medium text-fg">
            {NODE_LABEL[step.node] ?? humanize(step.node)}
            <span className="sr-only">, status {step.status}</span>
          </p>
          <span className="tabular shrink-0 text-[11.5px] text-fg-faint">{step.duration_ms} ms</span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-soft">{step.summary}</p>
        {step.tool && <p className="mt-1 text-[11.5px] text-fg-faint">Tool: {step.tool}</p>}
        {hasDetail && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
            <ChevronDown className={clsx("size-3 transition-transform", open && "rotate-180")} aria-hidden />
            {open ? "Hide" : "Show"} input and output
          </button>
        )}
        {open && (
          <div className="mt-2 grid gap-2">
            {(["input", "output"] as const).map((k) => (
              Object.keys(step[k]).length > 0 && (
                <div key={k}>
                  <p className="mb-1 text-[11.5px] text-fg-faint capitalize">{k}</p>
                  <pre className="scroll-quiet max-h-56 overflow-auto rounded-[7px] border border-line bg-surface p-2 text-[11.5px] leading-snug text-fg-soft">{JSON.stringify(step[k], null, 2)}</pre>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
