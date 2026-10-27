"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  const nav = (layoutGroup: string) => (
    <nav aria-label="Workspace" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const count = href === "/app/approvals" ? pending.data?.length ?? 0 : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors",
              active ? "font-medium text-fg" : "text-fg-soft hover:bg-well hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={`nav-${layoutGroup}`}
                className="absolute inset-0 rounded-[10px] border border-line-strong bg-raised shadow-[var(--shadow-lift)]"
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              >
                <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-accent shadow-[0_0_12px_rgb(91_140_255/0.9)]" />
              </motion.span>
            )}
            <Icon className={clsx("relative size-[17px]", active ? "text-accent" : "text-fg-faint group-hover:text-fg-soft")} aria-hidden />
            <span className="relative flex-1">{label}</span>
            {count > 0 && (
              <span className="tabular relative rounded-full bg-accent px-1.5 text-[11px] leading-[18px] font-semibold text-canvas" aria-label={`${count} pending`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const userBlock = me.data && (
    <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-surface/70 p-2.5">
      <Avatar name={me.data.name} className="size-8 text-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{me.data.name}</p>
        <p className="text-[12px] text-fg-faint">{me.data.role === "lead" ? "Team lead" : "Support agent"}</p>
      </div>
      <button type="button" onClick={() => void signOut()} className="grid size-9 place-items-center rounded-[8px] text-fg-faint transition-colors hover:bg-well hover:text-fg" aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </button>
    </div>
  );

  const demoNote = (
    <p className="rounded-[10px] border border-dashed border-line-strong px-3 py-2 text-[12px] leading-snug text-fg-faint">
      Demo workspace for the fictional store Halden &amp; Co. All data is synthetic.
    </p>
  );

  return (
    <UserCtx.Provider value={me.data ?? null}>
      <ToastProvider>
        <a href="#main" className="sr-only z-50 rounded bg-accent-fill px-3 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to content</a>
        <div className="flex h-dvh overflow-hidden bg-canvas">
          <aside className="relative hidden w-[240px] shrink-0 flex-col justify-between border-r border-line bg-[linear-gradient(180deg,#0a1020_0%,#060912_60%)] px-3 py-5 lg:flex">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(70%_100%_at_30%_0%,rgb(42_98_236/0.16),transparent)]" />
            <div className="relative space-y-8">
              <Wordmark href="/app/inbox" className="px-2" />
              <div className="space-y-2">
                <p className="eyebrow px-3">Workspace</p>
                {nav("side")}
              </div>
            </div>
            <div className="relative space-y-3">
              {demoNote}
              {userBlock}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="glass relative z-10 flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
              <Wordmark href="/app/inbox" />
              <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-[10px] text-fg hover:bg-well" aria-label="Open navigation" aria-expanded={open}>
                <Menu className="size-5" />
              </button>
            </header>
            <main id="main" className="min-h-0 flex-1 overflow-hidden">
              {/* Opacity only: a transform here would re-anchor fixed-position dialogs inside pages. */}
              <motion.div key={pathname} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
                {children}
              </motion.div>
            </main>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <motion.div className="absolute inset-0 bg-scrim/70 backdrop-blur-[3px]" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <motion.div
                className="absolute inset-y-0 right-0 flex w-[min(300px,86vw)] flex-col justify-between border-l border-line-strong bg-surface p-4 shadow-[var(--shadow-float)]"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 42 }}
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Wordmark href="/app/inbox" />
                    <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-[10px] hover:bg-well" aria-label="Close navigation" autoFocus>
                      <X className="size-5" />
                    </button>
                  </div>
                  {nav("drawer")}
                </div>
                <div className="space-y-3">
                  {demoNote}
                  {userBlock}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </ToastProvider>
    </UserCtx.Provider>
  );
}
