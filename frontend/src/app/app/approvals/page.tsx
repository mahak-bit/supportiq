"use client";

import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useResource } from "@/lib/api";
import type { Approval } from "@/lib/types";
import { ApprovalCard } from "@/components/ApprovalCard";
import { useUser } from "@/components/AppShell";
import { EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui";

type Filter = "pending" | "approved" | "rejected" | "all";

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<Filter>("pending");
  const res = useResource<Approval[]>(`/approvals?status=${filter}`);
  const user = useUser();
  const items = res.data ?? [];
  const forLead = items.filter((a) => a.required_role === "lead");
  const forAgent = items.filter((a) => a.required_role !== "lead");

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <h1 className="font-display text-[2rem] text-ink">Approvals</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft">
          Everything the agent proposed that changes something for a customer waits here for a person. Refunds above $300,
          policy exceptions and escalated replies need a team lead{user?.role === "lead" ? ", which is you" : ""}.
        </p>
        <div className="mt-6">
          <Segmented label="Approval status" value={filter} onChange={setFilter}
            options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All" }]} />
        </div>
        <div className="mt-6">
          {res.error ? (
            <ErrorState message={res.error.message} onRetry={() => void res.reload()} />
          ) : !res.data ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={<CheckCheck className="size-5" aria-hidden />} title={filter === "pending" ? "Nothing waiting on you" : "No decisions yet"}
              body={filter === "pending" ? "Run the agent on a ticket in the inbox; any reply, refund or return it proposes will appear here." : undefined} />
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {[{ title: "Team lead", list: forLead }, { title: "Any agent", list: forAgent }].map((g) => (
                <section key={g.title} aria-label={g.title}>
                  <h2 className="mb-3 text-[13px] font-semibold text-ink">{g.title} <span className="font-normal text-ink-faint tabular">{g.list.length}</span></h2>
                  <div className="space-y-2">
                    {g.list.length ? g.list.map((a) => <ApprovalCard key={a.id} approval={a} showTicket onDecided={() => res.reload()} />)
                      : <p className="text-[13px] text-ink-faint">None.</p>}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
