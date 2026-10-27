import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { OrbitFallback } from "@/components/landing/HeroVisual";
import { Wordmark } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grain grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Wordmark />
        <main className="flex flex-1 items-center">
          <div className="w-full max-w-sm py-12">
            <p className="eyebrow">Live demo workspace</p>
            <h1 className="font-display mt-3 text-page text-fg">
              Sign in to the <span className="font-editorial text-accent-bright">demo</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-soft">
              Pick a demo role or use the credentials below. Everything you see is synthetic data for a fictional store.
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-[radial-gradient(70%_60%_at_60%_38%,rgb(42_98_236/0.28),transparent_70%),#070b16] lg:block" aria-hidden>
        <div className="absolute inset-x-0 top-[6%] h-[58%] opacity-90">
          <OrbitFallback />
        </div>
        <div className="relative flex h-full flex-col justify-end p-14">
          <p className="font-display max-w-md text-[2rem] leading-snug tracking-[-0.03em] text-fg">
            “Two of the dinner plates are cracked <span className="font-editorial text-accent-bright">straight through.</span>”
          </p>
          <p className="mt-4 max-w-sm text-fg-soft">
            Waiting in the demo queue: a damaged delivery, a lost parcel, a refund outside the window, and someone who claims
            to be the store manager.
          </p>
        </div>
      </aside>
    </div>
  );
}
