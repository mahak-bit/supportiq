"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { Button, ErrorState, Field, Input } from "@/components/ui";

const DEMO = [
  { email: "agent@supportiq.demo", label: "Ava Chen", role: "Support agent", note: "Approves replies and refunds up to $300" },
  { email: "lead@supportiq.demo", label: "Jordan Blake", role: "Team lead", note: "Handles escalations and large refunds" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(DEMO[0]!.email);
  const [password, setPassword] = useState("demo-password");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent, override?: string) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api<User>("/auth/login", { method: "POST", json: { email: override ?? email, password } });
      const next = params.get("next");
      router.replace(next && next.startsWith("/app") ? next : "/app/inbox");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-2">
        {DEMO.map((d) => (
          <button
            key={d.email}
            type="button"
            disabled={busy}
            onClick={() => {
              setEmail(d.email);
              void submit(undefined, d.email);
            }}
            className="group flex items-center justify-between rounded-[10px] border border-rule-strong bg-paper px-4 py-3 text-left transition-colors hover:border-ink disabled:opacity-60"
          >
            <span>
              <span className="block text-[14.5px] font-medium text-ink">Continue as {d.label}</span>
              <span className="block text-[12.5px] text-ink-soft">{d.role}. {d.note}.</span>
            </span>
            <span className="text-ink-faint transition-transform group-hover:translate-x-0.5" aria-hidden>›</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[12px] text-ink-faint">
        <span className="h-px flex-1 bg-rule" /> or sign in with email <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password" hint="Demo password: demo-password">
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <ErrorState message={error} compact />}
        <Button type="submit" variant="primary" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </div>
  );
}
