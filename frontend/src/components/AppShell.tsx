"use client";

import clsx from "clsx";
import { BarChart3, BookOpen, CheckCheck, Inbox, LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, useResource } from "@/lib/api";
import type { Approval, User } from "@/lib/types";
import { Avatar, ToastProvider, Wordmark } from "@/components/ui";

const UserCtx = createContext<User | null>(null);
export const useUser = () => useContext(UserCtx);

const NAV = [
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/approvals", label: "Approvals", icon: CheckCheck },
  { href: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useResource<User>("/auth/me");
  const pending = useResource<Approval[]>("/approvals?status=pending", { pollMs: 20000 });
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  // Refresh the approvals badge whenever the route changes (e.g. after deciding one).
  const reloadPending = pending.reload;
  useEffect(() => void reloadPending(), [pathname, reloadPending]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  const nav = (
    <nav aria-label="Workspace" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const count = href === "/app/approvals" ? pending.data?.length ?? 0 : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-9 items-center gap-3 rounded-[8px] px-3 text-[14px] transition-colors",
              active ? "bg-paper font-medium text-ink shadow-[var(--shadow-lift)]" : "text-ink-soft hover:bg-ivory-deep hover:text-ink",
            )}
          >
            <Icon className={clsx("size-4", active ? "text-cobalt" : "")} aria-hidden />
            <span className="flex-1">{label}</span>
            {count > 0 && <span className="tabular rounded-full bg-cobalt px-1.5 text-[11px] leading-[18px] font-semibold text-paper" aria-label={`${count} pending`}>{count}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = me.data && (
    <div className="flex items-center gap-2.5 border-t border-rule pt-4">
      <Avatar name={me.data.name} className="size-8 text-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{me.data.name}</p>
        <p className="text-[12px] text-ink-faint capitalize">{me.data.role === "lead" ? "Team lead" : "Support agent"}</p>
      </div>
      <button type="button" onClick={() => void signOut()} className="rounded-md p-1.5 text-ink-faint hover:bg-ivory-deep hover:text-ink" aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <UserCtx.Provider value={me.data ?? null}>
      <ToastProvider>
        <a href="#main" className="sr-only z-50 rounded bg-ink px-3 py-2 text-paper focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
        <div className="flex h-dvh overflow-hidden">
          <aside className="hidden w-[228px] shrink-0 flex-col justify-between border-r border-rule bg-ivory px-3 py-5 lg:flex">
            <div className="space-y-7">
              <Wordmark href="/app/inbox" className="px-2" />
              {nav}
            </div>
            <div className="space-y-4 px-1">
              <p className="rounded-[8px] border border-dashed border-rule-strong px-3 py-2 text-[12px] leading-snug text-ink-soft">
                Demo workspace for the fictional store Halden &amp; Co. All data is synthetic.
              </p>
              {userBlock}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b border-rule bg-ivory px-4 lg:hidden">
              <Wordmark href="/app/inbox" />
              <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-ink" aria-label="Open navigation" aria-expanded={open}>
                <Menu className="size-5" />
              </button>
            </header>
            <main id="main" className="min-h-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </div>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-[280px] flex-col justify-between bg-ivory p-4 shadow-[var(--shadow-float)]">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Wordmark href="/app/inbox" />
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2" aria-label="Close navigation"><X className="size-5" /></button>
                </div>
                {nav}
              </div>
              {userBlock}
            </div>
          </div>
        )}
      </ToastProvider>
    </UserCtx.Provider>
  );
}
