"use client";

import clsx from "clsx";
import { FileText, FileUp, Search, Sparkles, Trash2, X } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { api, ApiError, useResource } from "@/lib/api";
import type { AskResult, DocumentDetail, KnowledgeDocument, SearchResult } from "@/lib/types";
import { fileSize, relativeTime } from "@/lib/format";
import { useUser } from "@/components/AppShell";
import { CitationList, ValidationReport } from "@/components/inbox/Citations";
import { Badge, Button, Dialog, EmptyState, ErrorState, Segmented, Skeleton, Spinner, Textarea, useToast } from "@/components/ui";

const ACCEPT = [".pdf", ".md", ".txt"];
const MAX_MB = 10;

const STATUS: Record<KnowledgeDocument["status"], { label: string; tone: "neutral" | "cobalt" | "moss" | "brick" }> = {
  queued: { label: "Queued", tone: "neutral" },
  processing: { label: "Indexing", tone: "cobalt" },
  indexed: { label: "Indexed", tone: "moss" },
  failed: { label: "Failed", tone: "brick" },
};

export default function KnowledgePage() {
  const docs = useResource<KnowledgeDocument[]>("/knowledge/documents");
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="scroll-quiet h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
        <h1 className="font-display text-page text-fg">Knowledge base</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-fg-soft">
          Policies, product guides and FAQs the agent may quote. Each file is split into passages, embedded locally and
          searched on every draft. Replies can only cite what’s indexed here.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <Uploader onUploaded={async () => { await docs.reload(); }} pollUntilDone={docs.reload} />
            <DocumentList docs={docs} selected={selected} onSelect={setSelected} />
          </div>
          <div>
            {selected !== null ? (
              <DocumentPreview id={selected} onClose={() => setSelected(null)} onDeleted={async () => { setSelected(null); await docs.reload(); }} />
            ) : (
              <AskPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Uploader({ onUploaded, pollUntilDone }: { onUploaded: () => Promise<void>; pollUntilDone: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPT.includes(ext)) return setError(`“${file.name}” isn’t supported. Upload a PDF, Markdown or plain-text file.`);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`“${file.name}” is ${fileSize(file.size)}. The limit is ${MAX_MB} MB.`);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const doc = await api<KnowledgeDocument>("/knowledge/documents", { method: "POST", body: form });
      toast(`Uploaded “${doc.title}”. Indexing now.`);
      await onUploaded();
      // Poll until the background job finishes so status updates without a refresh.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const d = await api<KnowledgeDocument>(`/knowledge/documents/${doc.id}`);
        if (d.status === "indexed" || d.status === "failed") {
          toast(d.status === "indexed" ? `“${d.title}” is indexed: ${d.chunk_count} passages` : `Indexing failed: ${d.error}`, d.status === "failed" ? "error" : "ok");
          break;
        }
      }
      await pollUntilDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void upload(f);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={clsx("rounded-[var(--radius-panel)] border border-dashed p-6 text-center transition-colors", drag ? "border-accent bg-accent-wash/50" : "border-line-strong bg-surface/70")}
      >
        <FileUp className="mx-auto size-6 text-fg-faint" aria-hidden />
        <p className="mt-2 text-[14px] text-fg">Drop a policy or product document here</p>
        <p className="mt-0.5 text-[12.5px] text-fg-faint">PDF, Markdown or plain text, up to {MAX_MB} MB. Scanned PDFs without text can’t be read.</p>
        <input ref={input} type="file" accept={ACCEPT.join(",")} className="sr-only" id="kb-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <Button className="mt-4" size="sm" variant="primary" loading={busy} onClick={() => input.current?.click()}>Choose a file</Button>
        <p className="mt-3 text-[12px] text-fg-faint">Try <span className="text-fg-soft">sample-docs/gift-services.md</span> from the repository, then ask about engraving.</p>
      </div>
      {error && <div className="mt-3"><ErrorState message={error} compact /></div>}
    </div>
  );
}

function DocumentList({ docs, selected, onSelect }: { docs: ReturnType<typeof useResource<KnowledgeDocument[]>>; selected: number | null; onSelect: (id: number) => void }) {
  if (docs.error) return <ErrorState message={docs.error.message} onRetry={() => void docs.reload()} />;
  if (!docs.data) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (!docs.data.length) return <EmptyState title="No documents yet" body="Upload your returns policy first. It answers the most tickets." />;
  return (
    <ul className="edge-light divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      {docs.data.map((d) => {
        const s = STATUS[d.status];
        return (
          <li key={d.id}>
            <button type="button" onClick={() => onSelect(d.id)} aria-pressed={selected === d.id}
              className={clsx("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors", selected === d.id ? "bg-accent-wash/40" : "hover:bg-raised/60")}>
              <FileText className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{d.title}</span>
                <span className="block truncate text-[12.5px] text-fg-faint">
                  {d.filename}, {fileSize(d.size_bytes)}{d.status === "indexed" ? `, ${d.chunk_count} passages` : ""}, {d.source === "seed" ? "seeded" : `uploaded ${relativeTime(d.created_at)}`}
                </span>
                {d.status === "failed" && <span className="mt-1 block text-[12.5px] text-brick">{d.error}</span>}
              </span>
              <Badge tone={s.tone}>{(d.status === "processing" || d.status === "queued") && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}{s.label}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentPreview({ id, onClose, onDeleted }: { id: number; onClose: () => void; onDeleted: () => Promise<void> }) {
  const res = useResource<DocumentDetail>(`/knowledge/documents/${id}`);
  const user = useUser();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = res.data;

  async function remove() {
    setBusy(true);
    try {
      await api(`/knowledge/documents/${id}`, { method: "DELETE" });
      toast("Document removed from the knowledge base");
      setConfirm(false);
      await onDeleted();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Document preview" className="edge-light rounded-[var(--radius-panel)] border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl text-fg">{d?.title ?? "Loading"}</h2>
          {d && <p className="mt-0.5 text-[12.5px] text-fg-faint">{d.chunk_count} passages, embedded with {d.embedding_model || "—"}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          {user?.role === "lead" && d && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirm(true)}>Delete</Button>}
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-faint hover:bg-well hover:text-fg" aria-label="Close preview"><X className="size-4" /></button>
        </div>
      </div>
      <div className="scroll-quiet max-h-[70vh] space-y-3 overflow-y-auto p-5">
        {res.error && <ErrorState message={res.error.message} onRetry={() => void res.reload()} />}
        {!d && !res.error && <Spinner />}
        {d?.status === "failed" && <ErrorState message={d.error} />}
        {d?.chunks.map((c) => (
          <article key={c.id} className="rounded-[9px] border border-line p-3">
            <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-faint">
              <Badge tone="cobalt">{c.id}</Badge>{c.section && <span>{c.section}</span>}{c.page && <span>Page {c.page}</span>}
            </p>
            <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-fg-soft">{c.text}</p>
          </article>
        ))}
        {user?.role !== "lead" && d && <p className="text-[12px] text-fg-faint">Only team leads can delete documents.</p>}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Delete “${d?.title ?? ""}”?`}
        description="Its passages are removed from search immediately. Drafts that already cite it keep their copy of the excerpt."
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void remove()}>Delete document</Button></>} />
    </section>
  );
}

function AskPanel() {
  const [mode, setMode] = useState<"ask" | "search">("ask");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [search, setSearch] = useState<SearchResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "ask") setAnswer(await api<AskResult>("/knowledge/ask", { method: "POST", json: { question: q } }));
      else setSearch(await api<SearchResult>("/knowledge/search", { method: "POST", json: { query: q, k: 8 } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Ask the knowledge base" className="edge-light rounded-[var(--radius-panel)] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-fg">{mode === "ask" ? "Ask a policy question" : "Search passages"}</h2>
        <Segmented label="Mode" size="sm" value={mode} onChange={(m) => { setMode(m); setError(""); }}
          options={[{ value: "ask", label: "Answer with sources" }, { value: "search", label: "Raw retrieval" }]} />
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3">
        <label htmlFor="kbq" className="sr-only">Question</label>
        <Textarea id="kbq" rows={2} value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000}
          placeholder={mode === "ask" ? "e.g. Can a customer return a final-sale item that arrived broken?" : "e.g. lost package"}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e as unknown as FormEvent); }} />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-fg-faint">Ctrl + Enter to submit</span>
          <Button type="submit" variant="primary" size="sm" loading={busy} disabled={q.trim().length < 3}
            icon={mode === "ask" ? <Sparkles className="size-3.5" /> : <Search className="size-3.5" />}>{mode === "ask" ? "Answer" : "Search"}</Button>
        </div>
      </form>
      {error && <div className="mt-4"><ErrorState message={error} compact /></div>}

      {mode === "ask" && answer && (
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-fg">{answer.answer}</p>
          <ValidationReport validation={answer.validation} insufficient={answer.insufficient_evidence} />
          <CitationList citations={answer.citations} />
          <p className="text-[12px] text-fg-faint">
            {answer.provider === "extractive" ? "Extractive mode: sentences quoted from sources, no language model configured." : `Generated by ${answer.model}.`}{" "}
            {answer.retrieved.length} passages passed the relevance threshold.
          </p>
        </div>
      )}
      {mode === "search" && search && (
        <div className="mt-6 space-y-2 border-t border-line pt-5">
          <p className="text-[12.5px] text-fg-faint">Passages below {Math.round(search.threshold * 100)}% similarity are never shown to the model.</p>
          {search.results.length === 0 && <p className="text-[13px] text-fg-soft">No indexed passages yet.</p>}
          {search.results.map((p) => (
            <article key={p.chunk_id} className={clsx("rounded-[9px] border p-3", p.above_threshold ? "border-line" : "border-dashed border-line opacity-60")}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate font-medium text-fg">{p.document_title}{p.section ? `, ${p.section}` : ""}</span>
                <span className="tabular shrink-0 text-fg-soft">{Math.round(p.score * 100)}%{p.above_threshold ? "" : ", below threshold"}</span>
              </div>
              <p className="line-clamp-4 text-[13px] leading-relaxed text-fg-soft">{p.text}</p>
            </article>
          ))}
        </div>
      )}
      {!answer && !search && (
        <p className="mt-6 border-t border-line pt-5 text-[13px] text-fg-soft">
          Answers use the same retrieval, prompting and citation checks as ticket drafts, so this is a quick way to see what
          the agent would find.
        </p>
      )}
    </section>
  );
}
