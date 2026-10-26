"use client";

import clsx from "clsx";
import { CheckCircle2, CircleDashed, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api, ApiError, useResource } from "@/lib/api";
import type { SystemStatus } from "@/lib/types";
import { useUser } from "@/components/AppShell";
import { Badge, Button, ErrorState, Skeleton, useToast } from "@/components/ui";

export default function SettingsPage() {
  const res = useResource<SystemStatus>("/system/status");
  const user = useUser();
  const toast = useToast();
  const [reindexing, setReindexing] = useState(false);
  const s = res.data;

  async function reindex() {
    setReindexing(true);
    try {
      await api("/knowledge/reindex", { method: "POST" });
      await res.reload();
      toast("All passages re-embedded with the current model");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Re-indexing failed.", "error");
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        <h1 className="font-display text-[2rem] text-ink">Settings</h1>
        <p className="mt-1.5 text-[15px] text-ink-soft">
          How this workspace is configured. Secrets live in the backend’s environment and are never shown here, only whether they are set.
        </p>
        {res.error ? (
          <div className="mt-6"><ErrorState message={res.error.message} onRetry={() => void res.reload()} /></div>
        ) : !s ? (
          <div className="mt-8 space-y-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="mt-8 space-y-6">
            <Card title="Workspace">
              <Row k="Store name" v={s.workspace.company_name} />
              <Row k="Environment" v={s.workspace.environment} />
              <Row k="Lead approval needed above" v={`$${s.limits.refund_lead_approval_threshold.toFixed(2)}`} />
              <Row k="Your role" v={user?.role === "lead" ? "Team lead" : "Support agent"} />
            </Card>

            <Card title="Language model" badge={s.llm.is_llm ? <Badge tone="moss">Connected</Badge> : <Badge tone="amber">No model configured</Badge>}>
              <Row k="Active provider" v={s.llm.is_llm ? `${s.llm.active_provider} (${s.llm.active_model})` : "Extractive mode: quotes sources, no generated prose"} />
              <Row k="Provider setting" v={s.llm.configured_provider} />
              <Check ok={s.llm.gemini_key_present} label={`Gemini API key ${s.llm.gemini_key_present ? "is set" : "is not set"} (model ${s.llm.gemini_model})`} />
              <Check ok={s.llm.ollama_reachable} label={`Ollama ${s.llm.ollama_reachable ? "is reachable" : "is not reachable"} (model ${s.llm.ollama_model})`} />
              <Row k="Timeout and retries" v={`${s.llm.timeout_seconds}s, up to ${s.llm.max_retries} retries`} />
              {!s.llm.is_llm && (
                <div className="mt-4 rounded-[9px] bg-ivory p-4 text-[13.5px] leading-relaxed text-ink-soft">
                  <p className="font-medium text-ink">Connect a model</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>Create a key in Google AI Studio (Gemini has a free tier with rate limits; check current limits there).</li>
                    <li>Add <code className="rounded bg-paper px-1">GEMINI_API_KEY=…</code> to <code className="rounded bg-paper px-1">backend/.env</code>.</li>
                    <li>Restart the backend. Or install Ollama, run <code className="rounded bg-paper px-1">ollama pull llama3.2:3b</code>, and set <code className="rounded bg-paper px-1">LLM_PROVIDER=ollama</code>.</li>
                  </ol>
                </div>
              )}
            </Card>

            <Card title="Retrieval" badge={<Badge tone="cobalt">{s.retrieval.indexed_chunks} passages indexed</Badge>}>
              <Row k="Embeddings" v={s.retrieval.embedding} />
              <Row k="Index" v={s.retrieval.index_backend} />
              <Row k="Passages per query" v={String(s.retrieval.top_k)} />
              <Row k="Minimum similarity" v={`${Math.round(s.retrieval.min_score * 100)}%`} />
              <Row k="Chunk size and overlap" v={`${s.retrieval.chunk_size} / ${s.retrieval.chunk_overlap} characters`} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link href="/app/knowledge" className="text-[13.5px] text-cobalt hover:underline">Manage documents</Link>
                {user?.role === "lead" && (
                  <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={reindexing} onClick={() => void reindex()}>Re-embed all passages</Button>
                )}
              </div>
              {user?.role === "lead" && <p className="mt-2 text-[12px] text-ink-faint">Use after changing EMBEDDING_MODEL. Passages from other models are excluded from search until re-embedded.</p>}
            </Card>

            <Card title="Storage">
              <Row k="Database" v={s.storage.dialect} />
              <Row k="Where" v={s.storage.note} />
              <Row k="Records" v={`${s.counts.tickets} tickets, ${s.counts.documents} documents, ${s.counts.chunks} passages`} />
              <Row k="Upload limit" v={`${s.limits.max_upload_mb} MB per file`} />
              <Row k="AI requests" v={`${s.limits.ai_requests_per_minute} per minute per user`} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-rule bg-paper p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-lg text-ink">{title}</h2>{badge}</div>
      <dl className="divide-y divide-rule">{children}</dl>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 py-2 text-[13.5px] sm:grid-cols-[12rem_1fr]">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="break-words text-ink">{v}</dd>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : CircleDashed;
  return (
    <div className="flex items-center gap-2 py-2 text-[13.5px]">
      <Icon className={clsx("size-4", ok ? "text-moss" : "text-ink-faint")} aria-hidden />
      <span className="text-ink">{label}</span>
    </div>
  );
}
