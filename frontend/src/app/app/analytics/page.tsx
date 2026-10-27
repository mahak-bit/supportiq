"use client";

import { useState } from "react";
import { useResource } from "@/lib/api";
import type { Analytics } from "@/lib/types";
import { duration, humanize, shortDate } from "@/lib/format";
import { ErrorState, SampleDataNote, Segmented, Skeleton } from "@/components/ui";

// Series colours for the dark panel: blue vs amber stays distinct under common colour-vision
// deficiencies and both clear 3:1 against the surface. The table view gives exact values.
const C_CREATED = "#5b8cff";
const C_RESOLVED = "#f0b457";

export default function AnalyticsPage() {
  const [days, setDays] = useState<"14" | "30" | "60">("30");
  const res = useResource<Analytics>(`/analytics/summary?days=${days}`);
  const a = res.data;

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-page text-fg">Analytics</h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-fg-soft">Calculated live from the ticket database each time you open this page.</p>
          </div>
          <Segmented label="Time range" value={days} onChange={setDays}
            options={[{ value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} />
        </div>

        {a && (
          <div className="mt-4">
            <SampleDataNote>
              {a.provenance.tickets_synthetic === a.provenance.tickets_total
                ? `All ${a.provenance.tickets_total} tickets are synthetic demo data, so these figures describe the demo, not real performance.`
                : `${a.provenance.tickets_synthetic} of ${a.provenance.tickets_total} tickets are synthetic demo data.`}
            </SampleDataNote>
          </div>
        )}

        {res.error ? (
          <div className="mt-6"><ErrorState message={res.error.message} onRetry={() => void res.reload()} /></div>
        ) : !a ? (
          <div className="mt-8 grid gap-4"><Skeleton className="h-20" /><Skeleton className="h-72" /><Skeleton className="h-56" /></div>
        ) : (
          <>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line md:grid-cols-5">
              {[
                ["Tickets created", String(a.totals.created)],
                ["Resolved", String(a.totals.resolved)],
                ["Open now", String(a.totals.open_now)],
                ["Median first response", duration(a.totals.median_first_response_minutes)],
                ["Median time to resolve", a.totals.median_resolution_hours === null ? "—" : duration(a.totals.median_resolution_hours * 60)],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-4 py-4">
                  <dt className="text-[12.5px] text-fg-soft">{k}</dt>
                  <dd className="font-display tabular mt-1.5 text-metric text-fg">{v}</dd>
                </div>
              ))}
            </dl>

            <VolumeChart series={a.series} />

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section aria-labelledby="cat-h" className="edge-light rounded-[var(--radius-panel)] border border-line bg-surface p-5">
                <h2 id="cat-h" className="font-display text-lg text-fg">Tickets by category</h2>
                <p className="mt-0.5 text-[12.5px] text-fg-faint">Created in the last {a.window_days} days, with median time to resolve.</p>
                <CategoryBars cats={a.categories} />
              </section>

              <section aria-labelledby="agent-h" className="edge-light rounded-[var(--radius-panel)] border border-line bg-surface p-5">
                <h2 id="agent-h" className="font-display text-lg text-fg">Agent and approvals in this workspace</h2>
                <p className="mt-0.5 text-[12.5px] text-fg-faint">Counts of real actions taken here since the database was created.</p>
                <dl className="mt-4 divide-y divide-line text-[14px]">
                  {[
                    ["Agent runs", a.agent.runs],
                    ["Drafts generated", a.agent.drafts_generated],
                    ["Drafts approved and sent", a.agent.drafts_sent],
                    ["Edited by a person before sending", a.agent.drafts_edited_before_send],
                    ["Drafts that passed citation checks", a.agent.validation_pass_rate === null ? "—" : `${Math.round(a.agent.validation_pass_rate * 100)}%`],
                    ["Drafts with insufficient evidence", a.agent.insufficient_evidence_drafts],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between py-2"><dt className="text-fg-soft">{k}</dt><dd className="tabular font-medium text-fg">{v}</dd></div>
                  ))}
                </dl>
                {Object.keys(a.agent.decisions).length > 0 && (
                  <p className="mt-3 text-[12.5px] text-fg-soft">
                    Outcomes: {Object.entries(a.agent.decisions).map(([k, v]) => `${humanize(k)} ${v}`).join(", ")}.
                  </p>
                )}
                {a.agent.runs === 0 && <p className="mt-3 text-[12.5px] text-fg-faint">Run the agent on a ticket in the inbox to start filling this in.</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VolumeChart({ series }: { series: Analytics["series"] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((d) => Math.max(d.created, d.resolved)));
  const W = 900, H = 240, pad = { l: 28, r: 8, t: 12, b: 26 };
  const cw = (W - pad.l - pad.r) / series.length;
  const bw = Math.max(2, Math.min(9, cw / 2 - 2));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  const h = hover !== null ? series[hover] : undefined;

  return (
    <section aria-labelledby="vol-h" className="edge-light mt-8 rounded-[var(--radius-panel)] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="vol-h" className="font-display text-lg text-fg">Ticket volume</h2>
          <div className="mt-1.5 flex gap-4 text-[12.5px] text-fg-soft">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: C_CREATED }} />Created</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px]" style={{ background: C_RESOLVED }} />Resolved</span>
          </div>
        </div>
        <Segmented label="Volume view" size="sm" value={view} onChange={setView} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
      </div>

      {view === "chart" ? (
        <div className="relative mt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tickets created and resolved per day. Switch to the table view for exact values.">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
                <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-fg-faint)">{t}</text>
              </g>
            ))}
            {series.map((d, i) => {
              const x = pad.l + i * cw + cw / 2;
              return (
                <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={pad.l + i * cw} y={pad.t} width={cw} height={H - pad.t - pad.b} fill={hover === i ? "var(--color-well)" : "transparent"} />
                  {d.created > 0 && <rect x={x - bw - 1} y={y(d.created)} width={bw} height={y(0) - y(d.created)} rx={2} fill={C_CREATED} />}
                  {d.resolved > 0 && <rect x={x + 1} y={y(d.resolved)} width={bw} height={y(0) - y(d.resolved)} rx={2} fill={C_RESOLVED} />}
                  {(i % Math.ceil(series.length / 6) === 0) && (
                    <text x={x} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-fg-faint)">{shortDate(d.date).replace(/, \d{4}$/, "")}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {h && hover !== null && (
            <div className="glass pointer-events-none absolute top-2 rounded-[8px] border border-line-strong px-3 py-2 text-[12.5px] text-fg shadow-[var(--shadow-float)]"
              style={{ left: `clamp(0px, calc(${((pad.l + hover * cw + cw / 2) / W) * 100}% - 70px), calc(100% - 150px))` }}>
              <p className="font-medium">{shortDate(h.date)}</p>
              <p>Created {h.created}, resolved {h.resolved}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="scroll-quiet mt-4 max-h-80 overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface text-left text-fg-soft"><tr><th className="py-1.5 font-medium">Date</th><th className="font-medium">Created</th><th className="font-medium">Resolved</th></tr></thead>
            <tbody className="tabular divide-y divide-line">
              {series.map((d) => <tr key={d.date}><td className="py-1.5 text-fg">{shortDate(d.date)}</td><td>{d.created}</td><td>{d.resolved}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CategoryBars({ cats }: { cats: Analytics["categories"] }) {
  const max = Math.max(1, ...cats.map((c) => c.count));
  if (!cats.length) return <p className="mt-4 text-[13px] text-fg-faint">No tickets in this window.</p>;
  return (
    <ul className="mt-4 space-y-2.5">
      {cats.map((c) => (
        <li key={c.category} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-[13px]" title={`${c.count} tickets`}>
          <span className="truncate text-fg">{humanize(c.category)}</span>
          <span className="h-2.5 overflow-hidden rounded-r-[4px] bg-well">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(c.count / max) * 100}%`, background: C_CREATED }} />
          </span>
          <span className="tabular w-28 text-right text-fg-soft">
            {c.count}<span className="text-fg-faint">{c.median_resolution_hours === null ? "" : `, ${duration(c.median_resolution_hours * 60)}`}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
