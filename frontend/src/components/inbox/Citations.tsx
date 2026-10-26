"use client";

import clsx from "clsx";
import { AlertTriangle, BadgeCheck, Database, FileText } from "lucide-react";
import { useState } from "react";
import type { Citation, Validation } from "@/lib/types";

/** Source list for a generated answer. Each entry expands to the exact passage used. */
export function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!citations.length) return null;
  return (
    <ol className="space-y-1.5">
      {citations.map((c, i) => {
        const isOpen = open === c.id;
        return (
          <li key={c.id} className="rounded-[9px] border border-rule bg-paper">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : c.id)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
            >
              <span className="tabular mt-px grid size-5 shrink-0 place-items-center rounded-full bg-cobalt-wash text-[11px] font-semibold text-cobalt-deep">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {c.kind === "passage" ? (
                  <>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <FileText className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                      <span className="truncate">{c.document_title}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-soft">
                      {c.section || "Body"}{c.page ? `, page ${c.page}` : ""}. Match {Math.round(c.score * 100)}%. {c.id}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <Database className="size-3.5 shrink-0 text-ink-faint" aria-hidden /> {c.label}
                    </span>
                    <span className="block text-[12.5px] text-ink-soft">Verified by a tool call ({c.id})</span>
                  </>
                )}
              </span>
            </button>
            {isOpen && (
              <blockquote className="mx-3 mb-3 border-l-2 border-cobalt/50 pl-3 text-[13px] leading-relaxed whitespace-pre-line text-ink-soft">
                {c.excerpt}
              </blockquote>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ValidationReport({ validation, insufficient }: { validation: Validation | Record<string, never>; insufficient: boolean }) {
  if (!("passed" in validation)) return null;
  const v = validation;
  const issues = [
    ...v.invalid_citation_ids.map((id) => `Cited ${id}, which was not among the retrieved sources (removed).`),
    ...v.unsupported_claims.map((c) => `Claim without a valid source: “${c}”`),
    ...(v.unverified_numbers.length ? [`Numbers not found in any source: ${v.unverified_numbers.join(", ")}. Check before sending.`] : []),
    ...(v.ungrounded ? ["The draft makes claims but cites nothing."] : []),
  ];
  if (insufficient) {
    return (
      <div className="flex gap-2.5 rounded-[9px] border border-amber/30 bg-amber-wash/70 px-3 py-2.5 text-[13px] text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden />
        <p>The knowledge base doesn’t cover this, so the draft is a holding reply. Consider escalating or adding a document.</p>
      </div>
    );
  }
  return (
    <div className={clsx("rounded-[9px] border px-3 py-2.5 text-[13px]", v.passed ? "border-moss/25 bg-moss-wash/60" : "border-brick/25 bg-brick-wash/60")}>
      <p className="flex items-center gap-2 font-medium text-ink">
        {v.passed ? <BadgeCheck className="size-4 text-moss" aria-hidden /> : <AlertTriangle className="size-4 text-brick" aria-hidden />}
        {v.passed ? "Every claim traces to a retrieved source or verified record." : "Citation check found problems."}
      </p>
      {issues.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-ink-soft">
          {issues.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}
