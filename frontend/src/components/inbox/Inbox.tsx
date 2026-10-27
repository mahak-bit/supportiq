"use client";

import clsx from "clsx";
import { MousePointerClick } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResource } from "@/lib/api";
import type { TicketList as TicketListData } from "@/lib/types";
import { Dialog, EmptyState, Kbd } from "@/components/ui";
import { TicketList, type Filters } from "./TicketList";
import { TicketWorkspace } from "./TicketWorkspace";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("t") ? Number(params.get("t")) : null;
  const [filters, setFiltersState] = useState<Filters>({ q: "", status: params.get("status") ?? "active", priority: "", category: "", sort: "priority" });
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDebounced(filters.q, 250);

  const path = useMemo(() => {
    const sp = new URLSearchParams({ status: filters.status, sort: filters.sort });
    if (q) sp.set("q", q);
    if (filters.priority) sp.set("priority", filters.priority);
    if (filters.category) sp.set("category", filters.category);
    return `/tickets?${sp.toString()}`;
  }, [q, filters.status, filters.sort, filters.priority, filters.category]);
  const list = useResource<TicketListData>(path);

  const setFilters = (f: Partial<Filters>) => setFiltersState((prev) => ({ ...prev, ...f }));
  const select = useCallback(
    (id: number | null) => {
      const sp = new URLSearchParams(params.toString());
      if (id === null) sp.delete("t");
      else sp.set("t", String(id));
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Keyboard: "/" search, j/k move through the queue, "?" shortcut help.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) {
        if (e.key === "Escape") el.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "?") setHelp(true);
      if ((e.key === "j" || e.key === "k") && list.data?.items.length) {
        e.preventDefault();
        const items = list.data.items;
        const idx = items.findIndex((t) => t.id === selected);
        const next = e.key === "j" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx < 0 ? 0 : idx - 1);
        const target = items[next];
        if (target) {
          select(target.id);
          document.querySelector(`[data-ticket-id="${target.id}"]`)?.scrollIntoView({ block: "nearest" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.data, selected, select]);

  return (
    <div className="flex h-full min-h-0">
      <div className={clsx("w-full shrink-0 border-r border-line bg-surface/50 md:w-[340px] lg:w-[360px]", selected !== null && "hidden md:block")}>
        <TicketList
          ref={searchRef}
          data={list.data}
          loading={list.loading}
          error={list.error?.message}
          onRetry={() => void list.reload()}
          filters={filters}
          setFilters={setFilters}
          selectedId={selected}
          onSelect={select}
        />
      </div>
      <div className={clsx("min-w-0 flex-1 bg-canvas", selected === null && "hidden md:block")}>
        {selected !== null ? (
          <TicketWorkspace key={selected} id={selected} onBack={() => select(null)} onListChanged={() => void list.reload()} />
        ) : (
          <div className="grid h-full place-items-center">
            <EmptyState
              icon={<MousePointerClick className="size-5" aria-hidden />}
              title="Pick a ticket to start"
              body={<>Select a conversation from the queue, or press <Kbd>j</Kbd> to open the first one. Press <Kbd>?</Kbd> for shortcuts.</>}
            />
          </div>
        )}
      </div>
      <Dialog open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[14px]">
          {[["/", "Search tickets"], ["j / k", "Next / previous ticket"], ["r", "Run the agent on the open ticket"], ["e", "Escalate the open ticket"], ["Esc", "Leave a text field or close a dialog"], ["?", "Show this list"]].map(([k, v]) => (
            <div key={k} className="contents"><dt><Kbd>{k}</Kbd></dt><dd className="text-fg-soft">{v}</dd></div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
