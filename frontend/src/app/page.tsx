import { Check, CircleSlash, FileText, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { ButtonLink, Wordmark } from "@/components/ui";

const PIPELINE = [
  { name: "Read the ticket", body: "Classifies intent, urgency and sentiment, and flags legal threats, chargebacks, safety reports and attempts to instruct the AI." },
  { name: "Look things up", body: "Finds the order in the order database (only if it belongs to this customer) and searches your policies for the passages that apply." },
  { name: "Check the rules", body: "Return windows, final-sale items, damage reports and approval limits are explicit code, not model judgement." },
  { name: "Draft with sources", body: "Writes a reply in the tone you choose. Every claim must cite a retrieved passage or a verified record; anything else is flagged." },
  { name: "You decide", body: "Nothing is sent and no refund is issued until a person approves it. Risky cases go to a team lead." },
];

const WONT = [
  "Send email or messages on its own. Approved replies are recorded on the ticket; connecting a mail provider is a deliberate next step.",
  "Move money. Refunds are proposed with the rule that allows them, and approved by a person in your payment system.",
  "Invent policy. When the knowledge base doesn't cover a question, the draft says so and suggests escalation.",
  "Follow instructions hidden in customer messages or uploaded documents. That text is handled as data and flagged.",
];

export default function Landing() {
  return (
    <div className="grain min-h-dvh">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
          <a href="#how" className="hidden rounded-md px-3 py-2 text-sm text-ink-soft hover:text-ink sm:inline">How it works</a>
          <a href="#limits" className="hidden rounded-md px-3 py-2 text-sm text-ink-soft hover:text-ink sm:inline">Guardrails</a>
          <ButtonLink href="/login" variant="secondary" size="sm">Sign in to demo</ButtonLink>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1240px] items-center gap-4 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-14 lg:pb-24">
          <div className="relative z-10 max-w-[620px]">
            <h1 className="font-display text-[2.7rem] leading-[1.02] font-medium text-ink sm:text-[4rem] lg:text-[4.6rem]">
              Every answer, held to the policy it came from.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.075rem] leading-relaxed text-ink-soft">
              SupportIQ is a support copilot for online stores. It reads each ticket, finds the passage in your policies that
              answers it, checks the order against your rules, and drafts a reply your team approves before anything is sent.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/login" size="lg">Open the demo workspace</ButtonLink>
              <ButtonLink href="#how" variant="ghost" size="lg">See how a ticket moves</ButtonLink>
            </div>
            <p className="mt-5 text-[13px] text-ink-faint">
              The demo runs on a fictional store with synthetic customers and orders. No sign-up needed.
            </p>
          </div>
          <div className="relative -mx-5 h-[340px] sm:mx-0 sm:h-[460px] lg:h-[560px]">
            <HeroVisual />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-rule bg-paper/80">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <h2 className="font-display text-[2.1rem] leading-tight text-ink sm:text-[2.6rem]">How a ticket moves</h2>
              <p className="mt-4 max-w-md text-ink-soft">
                A fixed, five-stage workflow. The model can't add steps, call tools that aren't on the list, or loop. Each stage
                writes to an audit trail you can read on the ticket.
              </p>
              <ol className="mt-10 space-y-7">
                {PIPELINE.map((s, i) => (
                  <li key={s.name} className="grid grid-cols-[2.25rem_1fr] gap-3">
                    <span className="font-display tabular grid size-8 place-items-center rounded-full border border-rule-strong text-[15px] text-ink">{i + 1}</span>
                    <div>
                      <h3 className="font-medium text-ink">{s.name}</h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <ExampleTicket />
          </div>
        </section>

        {/* Three disciplines */}
        <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8">
          <div className="grid gap-x-16 gap-y-12 md:grid-cols-3">
            <Pillar icon={<FileText className="size-5" />} title="Grounded drafting">
              Policies are chunked, embedded and indexed locally. Drafts must cite passage IDs from what was actually retrieved;
              invented IDs and numbers that don't appear in the evidence are caught and shown to the reviewer.
            </Pillar>
            <Pillar icon={<Workflow className="size-5" />} title="A bounded agent">
              A LangGraph state machine with typed tools: order lookup, knowledge search and a rules engine. Bounded retries,
              a time budget, and a step-by-step record of what was called and what came back.
            </Pillar>
            <Pillar icon={<ShieldCheck className="size-5" />} title="People stay in charge">
              Agents approve replies; refunds above $300, policy exceptions and sensitive tickets need a team lead. The model
              provider is swappable, and keys stay on the server.
            </Pillar>
          </div>
        </section>

        {/* Limits */}
        <section id="limits" className="bg-ink text-paper">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-display text-[2.1rem] leading-tight sm:text-[2.6rem]">What it won’t do</h2>
              <p className="mt-4 max-w-sm text-paper/70">Guardrails matter more than features when software talks to your customers.</p>
            </div>
            <ul className="divide-y divide-paper/15 border-y border-paper/15">
              {WONT.map((w) => (
                <li key={w} className="flex gap-4 py-5 text-[15.5px] leading-relaxed text-paper/90">
                  <CircleSlash className="mt-1 size-4 shrink-0 text-[#8fa4ff]" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-[1240px] px-5 py-20 text-center sm:px-8">
          <h2 className="font-display mx-auto max-w-2xl text-[2rem] leading-tight text-ink sm:text-[2.5rem]">
            Run the agent on a real ticket from the demo queue.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-ink-soft">
            Try the cracked dinner plates, the order that never arrived, or the customer who claims to be the store manager.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink href="/login" size="lg">Open the demo workspace</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-8 text-[13px] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark className="opacity-80" />
          <p>A portfolio project. Halden &amp; Co. and every customer in the demo are fictional.</p>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}

function Pillar({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-ink pt-5">
      <div className="flex items-center gap-2.5 text-cobalt">{icon}<h3 className="font-display text-xl text-ink">{title}</h3></div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

/** Illustration of a real seeded ticket as it looks after the agent has run. */
function ExampleTicket() {
  return (
    <figure className="self-start rounded-[16px] border border-rule bg-ivory p-2 shadow-[var(--shadow-float)]">
      <div className="rounded-[12px] border border-rule bg-paper">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <p className="text-sm font-medium text-ink">Plates arrived cracked</p>
          <span className="rounded-full bg-amber-wash px-2 py-0.5 text-[12px] font-medium text-amber">Awaiting approval</span>
        </div>
        <div className="space-y-5 px-5 py-5">
          <blockquote className="border-l-2 border-rule-strong pl-4 text-[14.5px] leading-relaxed text-ink-soft">
            “My Tidal dinner set arrived yesterday and two of the dinner plates are cracked straight through. Order HC-10433.”
          </blockquote>
          <div className="grid gap-2 text-[13.5px] sm:grid-cols-2">
            <div className="rounded-[9px] border border-rule bg-ivory/60 p-3">
              <p className="text-ink-faint">Evidence</p>
              <p className="mt-1 text-ink">Returns &amp; Refunds Policy, RR-3 Damaged or defective on arrival</p>
            </div>
            <div className="rounded-[9px] border border-rule bg-ivory/60 p-3">
              <p className="text-ink-faint">Rule check</p>
              <p className="mt-1 text-ink">Reported 5 days after delivery, within the 14-day window</p>
            </div>
          </div>
          <p className="text-[14.5px] leading-relaxed text-ink">
            Hi Daniel, I’m sorry your plates arrived damaged. Because you let us know within 14 days of delivery, you can choose a
            free replacement or a full refund, and there’s no return shipping to pay
            <sup className="ml-0.5 rounded bg-cobalt-wash px-1 text-[10.5px] font-semibold text-cobalt-deep">RR-3</sup>
          </p>
          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-ink px-3 text-[13px] font-medium text-paper"><Check className="size-3.5" /> Approve and send</span>
            <span className="inline-flex h-8 items-center rounded-[7px] border border-rule-strong px-3 text-[13px] text-ink">Approve refund of $142.00</span>
          </div>
        </div>
      </div>
      <figcaption className="px-3 pt-2.5 pb-1 text-[12.5px] text-ink-faint">Illustration of a seeded demo ticket after an agent run. The live version is in the workspace.</figcaption>
    </figure>
  );
}
