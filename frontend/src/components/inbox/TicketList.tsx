"use client";

import clsx from "clsx";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { forwardRef } from "react";
import type { TicketList as TicketListData } from "@/lib/types";
import { humanize, relativeTime } from "@/lib/format";
import { Badge, EmptyState, ErrorState, Kbd, PriorityMark, Skeleton, StatusBadge } from "@/components/ui";

export interface Filters {
  q: string;
  status: string;
  priority: string;
  category: string;
  sort: string;
}

const TABS = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "escalated", label: "Escalated" },
  { value: "pending", label: "Awaiting customer" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];
const CATEGORIES = ["", "uncategorized", "returns", "refunds", "shipping", "damaged_item", "product", "billing", "account", "other"];

interface Props {
  data: TicketListData | undefined;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export const TicketList = forwardRef<HTMLInputElement, Props>(function TicketList(
  { data, loading, error, onRetry, filters, setFilters, selectedId, onSelect },
  searchRef,
) {
  const hasFilters = Boolean(filters.q || filters.priority || filters.category);
  return (
    <section aria-label="Tickets" className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-line px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-[1.6rem] leading-none text-fg">Inbox</h1>
          <span className="text-[12.5px] text-fg-faint tabular">{data ? `${data.total} shown` : ""}</span>
        </div>
        <label className="relative block">
          <span className="sr-only">Search tickets</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Search name, email, order, message"
            className="h-9.5 w-full rounded-[var(--radius-control)] border border-line-strong bg-well pr-9 pl-9 text-[14px] placeholder:text-fg-faint transition-[border,box-shadow] hover:border-fg-faint focus:border-accent focus:shadow-[0_0_0_3px_rgb(91_140_255/0.18)] focus:outline-none"
          />
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2"><Kbd>/</Kbd></span>
        </label>
        <div role="tablist" aria-label="Ticket status" className="scroll-quiet -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          {TABS.map((t) => {
            const active = filters.status === t.value;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setFilters({ status: t.value })}
                className={clsx(
                  "flex h-7.5 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors",
                  active ? "bg-accent-wash text-accent-bright ring-1 ring-accent/40" : "text-fg-soft hover:bg-well hover:text-fg",
                )}
              >
                {t.label}
                <span className={clsx("tabular text-[11.5px]", active ? "text-accent-bright/75" : "text-fg-faint")}>{data?.counts[t.value] ?? ""}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-fg-faint" aria-hidden />
          <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value })}
            className="h-7.5 rounded-[6px] border border-line bg-well px-2 text-[12.5px] text-fg-soft hover:border-line-strong">
            <option value="">Any priority</option>
            {["urgent", "high", "normal", "low"].map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
          </select>
          <select aria-label="Filter by category" value={filters.category} onChange={(e) => setFilters({ category: e.target.value })}
            className="h-7.5 rounded-[6px] border border-line bg-well px-2 text-[12.5px] text-fg-soft hover:border-line-strong">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c ? humanize(c) : "Any category"}</option>)}
          </select>
          <select aria-label="Sort tickets" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}
            className="h-7.5 rounded-[6px] border border-line bg-well px-2 text-[12.5px] text-fg-soft hover:border-line-strong">
            <option value="priority">Priority first</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          {hasFilters && (
            <button type="button" onClick={() => setFilters({ q: "", priority: "", category: "" })} className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline">
              <X className="size-3" aria-hidden /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4"><ErrorState message={error} onRetry={onRetry} /></div>
        ) : !data && loading ? (
          <div className="space-y-px p-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="m-2 h-[76px]" />)}</div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? "No tickets match" : "Nothing here"}
            body={hasFilters ? "Try a different search or clear the filters." : "No tickets have this status right now."}
          />
        ) : (
          <ul role="listbox" aria-label="Ticket list" className="divide-y divide-line/70">
            {data?.items.map((t) => {
              const selected = t.id === selectedId;
              return (
                <li key={t.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    data-ticket-id={t.id}
                    onClick={() => onSelect(t.id)}
                    className={clsx(
                      "relative block w-full px-4 py-3.5 text-left transition-colors",
                      selected ? "bg-raised" : "hover:bg-surface",
                    )}
                  >
                    {selected && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent shadow-[0_0_12px_rgb(91_140_255/0.8)]" aria-hidden />}
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] text-fg-soft">{t.customer.name}</span>
                      <span className="shrink-0 text-[12px] text-fg-faint tabular">{relativeTime(t.created_at)}</span>
                    </span>
                    <span className={clsx("mt-0.5 block truncate text-[14.5px]", t.status === "open" ? "font-semibold text-fg" : "font-medium text-fg")}>{t.subject}</span>
                    <span className="mt-1 line-clamp-1 block text-[13px] text-fg-faint">{t.preview}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityMark priority={t.priority} />
                      <StatusBadge status={t.status} />
                      {t.category !== "uncategorized" && <Badge>{humanize(t.category)}</Badge>}
                      {t.pending_approvals > 0 && <Badge tone="amber">{t.pending_approvals} to approve</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
});
