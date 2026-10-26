import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grain grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Wordmark />
        <main className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <h1 className="font-display text-[2.2rem] leading-tight text-ink">Sign in to the demo</h1>
            <p className="mt-2 text-[15px] text-ink-soft">
              Pick a demo role or use the credentials below. Everything you see is synthetic data for a fictional store.
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink lg:block" aria-hidden>
        <div className="absolute inset-0 opacity-90" style={{ background: "radial-gradient(60% 50% at 70% 40%, #2448d855, transparent 70%)" }} />
        <div className="relative flex h-full flex-col justify-end p-14 text-paper">
          <p className="font-display max-w-md text-[2rem] leading-snug">
            “Two of the dinner plates are cracked straight through.”
          </p>
          <p className="mt-4 max-w-sm text-paper/60">
            Waiting in the demo queue: a damaged delivery, a lost parcel, a refund outside the window, and someone who claims
            to be the store manager.
          </p>
        </div>
      </aside>
    </div>
  );
}
