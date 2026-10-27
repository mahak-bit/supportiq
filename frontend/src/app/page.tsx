import clsx from "clsx";
import {
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  CircleSlash,
  FileSearch,
  Fingerprint,
  Gauge,
  GitBranch,
  ListChecks,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { Intro } from "@/components/landing/Intro";
import { HeroParallax, RevealObserver } from "@/components/landing/Motion";
import { ButtonLink, Wordmark } from "@/components/ui";

const REPO = "https://github.com/mahak-bit/supportiq";

const CAPABILITIES = [
  { icon: FileSearch, label: "Answers cite the policy passage they came from" },
  { icon: ListChecks, label: "Business rules run as code, not prompts" },
  { icon: UserCheck, label: "Nothing is sent without human approval" },
  { icon: ScrollText, label: "Every agent step is written to an audit trail" },
  { icon: Fingerprint, label: "Instructions hidden in messages are flagged" },
];

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

const STACK = [
  { icon: BookOpen, title: "Retrieval", items: ["PDF, Markdown and text ingestion", "Heading-aware chunking", "bge-small embeddings", "FAISS similarity search"] },
  { icon: GitBranch, title: "Agent", items: ["LangGraph state machine", "Typed, allow-listed tools", "Rules engine RR-0 to RR-8", "Time and step budgets"] },
  { icon: Bot, title: "Models", items: ["Gemini or local Ollama", "Extractive mode with no LLM", "Citation and number validation", "Abstains when evidence is thin"] },
  { icon: Gauge, title: "Platform", items: ["FastAPI and SQLAlchemy", "Role-based approvals", "Next.js App Router", "Unit, API and agent tests"] },
];

export default function Landing() {
  return (
    <>
      <Intro />
      <RevealObserver />
      <div className="grain min-h-dvh overflow-x-clip">
        <header className="glass sticky top-0 z-40 border-b border-line/70">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-8">
            <Wordmark />
            <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
              <a href="#product" className="hidden rounded-md px-3 py-2 text-[14px] text-fg-soft transition-colors hover:text-fg md:inline">Product</a>
              <a href="#how" className="hidden rounded-md px-3 py-2 text-[14px] text-fg-soft transition-colors hover:text-fg md:inline">Workflow</a>
              <a href="#limits" className="hidden rounded-md px-3 py-2 text-[14px] text-fg-soft transition-colors hover:text-fg md:inline">Guardrails</a>
              <a href="#stack" className="hidden rounded-md px-3 py-2 text-[14px] text-fg-soft transition-colors hover:text-fg md:inline">Under the hood</a>
              <ButtonLink href="/login" size="sm" className="ml-1">Open live demo</ButtonLink>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="relative">
            <div aria-hidden className="pointer-events-none absolute top-[-10%] left-1/2 h-[720px] w-[1100px] max-w-[160vw] -translate-x-1/2 bg-[radial-gradient(45%_45%_at_62%_45%,rgb(42_98_236/0.22),transparent_70%)]" />
            <div className="relative mx-auto grid max-w-[1240px] items-center gap-2 px-4 pt-10 pb-10 sm:px-8 lg:grid-cols-[1.08fr_1fr] lg:pt-20 lg:pb-16">
              <div className="relative z-10 max-w-[640px]">
                <p className="reveal inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/60 px-3 py-1 text-[12.5px] text-fg-soft">
                  <span className="pulse-ring size-1.5 rounded-full bg-cyan" aria-hidden />
                  AI support copilot for online stores
                </p>
                <h1 className="reveal font-display mt-6 text-hero font-medium text-fg" style={delay(60)}>
                  Every reply, held to the policy <span className="font-editorial text-gradient pr-1">behind it.</span>
                </h1>
                <p className="reveal mt-6 max-w-[35rem] text-lead text-fg-soft" style={delay(140)}>
                  SupportIQ reads each ticket, finds the passage in your policies that answers it, checks the order against your
                  rules, and drafts a reply your team approves before anything is sent.
                </p>
                <div className="reveal mt-9 flex flex-wrap items-center gap-3" style={delay(220)}>
                  <ButtonLink href="/login" size="lg" className="group">
                    Open the demo workspace <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </ButtonLink>
                  <ButtonLink href="#how" variant="secondary" size="lg">See how a ticket moves</ButtonLink>
                </div>
                <p className="reveal mt-5 text-[13px] text-fg-faint" style={delay(280)}>
                  The demo runs on a fictional store with synthetic customers and orders. No sign-up needed.
                </p>
              </div>
              <HeroParallax className="relative -mx-4 h-[320px] sm:mx-0 sm:h-[460px] lg:h-[580px]">
                <HeroVisual />
              </HeroParallax>
            </div>

            {/* What is true about it, at a glance */}
            <div className="relative mx-auto max-w-[1240px] px-4 pb-20 sm:px-8">
              <ul className="reveal grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
                {CAPABILITIES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-start gap-3 bg-surface/90 p-4 text-[13.5px] leading-snug text-fg-soft">
                    <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Product preview */}
          <section id="product" className="relative scroll-mt-20 border-t border-line">
            <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8 lg:py-28">
              <SectionHead eyebrow="The workspace" title={<>One screen from question to <span className="font-editorial text-accent-bright">approved reply.</span></>}>
                The inbox, the conversation, the evidence and the agent’s audit trail sit side by side, so a reviewer can check a
                draft against its sources before approving it.
              </SectionHead>
              <div className="reveal mt-12" style={delay(80)}>
                <ProductPreview />
              </div>
            </div>
          </section>

          {/* Workflow */}
          <section id="how" className="relative scroll-mt-20 border-t border-line bg-[linear-gradient(180deg,#080c18,#060912)]">
            <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:py-28">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <SectionHead eyebrow="Workflow" title="How a ticket moves">
                  A fixed, five-stage workflow. The model can’t add steps, call tools that aren’t on the list, or loop. Each stage
                  writes to an audit trail you can read on the ticket.
                </SectionHead>
              </div>
              <ol className="relative space-y-3">
                <span aria-hidden className="absolute top-6 bottom-6 left-[27px] w-px bg-[linear-gradient(180deg,var(--color-accent),var(--color-line-strong)_70%,transparent)]" />
                {PIPELINE.map((s, i) => (
                  <li key={s.name} className="reveal relative grid grid-cols-[3.5rem_1fr] gap-4 rounded-[var(--radius-panel)] p-3 transition-colors hover:bg-surface/70" style={delay(i * 70)}>
                    <span className="font-display tabular relative z-10 grid size-14 place-items-center rounded-full border border-line-strong bg-raised text-[15px] text-accent-bright shadow-[0_0_0_6px_var(--color-canvas)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="pt-2.5">
                      <h3 className="font-display text-[1.2rem] text-fg">{s.name}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-fg-soft">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Pillars */}
          <section className="border-t border-line">
            <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8 lg:py-28">
              <SectionHead eyebrow="Principles" title="Built to be checked, not trusted blindly" />
              <div className="mt-14 grid gap-x-12 gap-y-12 md:grid-cols-3">
                <Pillar i={0} icon={<FileSearch className="size-5" />} title="Grounded drafting">
                  Policies are chunked, embedded and indexed. Drafts must cite passage IDs from what was actually retrieved;
                  invented IDs and numbers that don’t appear in the evidence are caught and shown to the reviewer.
                </Pillar>
                <Pillar i={1} icon={<Workflow className="size-5" />} title="A bounded agent">
                  A LangGraph state machine with typed tools: order lookup, knowledge search and a rules engine. Bounded retries,
                  a time budget, and a step-by-step record of what was called and what came back.
                </Pillar>
                <Pillar i={2} icon={<ShieldCheck className="size-5" />} title="People stay in charge">
                  Agents approve replies; refunds above $300, policy exceptions and sensitive tickets need a team lead. The model
                  provider is swappable, and keys stay on the server.
                </Pillar>
              </div>
            </div>
          </section>

          {/* Guardrails */}
          <section id="limits" className="relative scroll-mt-20 overflow-hidden border-t border-line">
            <div aria-hidden className="pointer-events-none absolute -right-40 top-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgb(63_210_238/0.08),transparent)]" />
            <div className="relative mx-auto grid max-w-[1240px] gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
              <SectionHead eyebrow="Guardrails" title={<>What it <span className="font-editorial text-accent-bright">won’t</span> do</>}>
                Guardrails matter more than features when software talks to your customers.
              </SectionHead>
              <ul className="divide-y divide-line border-y border-line">
                {WONT.map((w, i) => (
                  <li key={w} className="reveal flex gap-4 py-6 text-[15.5px] leading-relaxed text-fg" style={delay(i * 70)}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-raised">
                      <CircleSlash className="size-4 text-cyan" aria-hidden />
                    </span>
                    <span className="pt-0.5">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Stack */}
          <section id="stack" className="scroll-mt-20 border-t border-line bg-[linear-gradient(180deg,#080c18,#060912)]">
            <div className="mx-auto max-w-[1240px] px-4 py-20 sm:px-8 lg:py-28">
              <SectionHead eyebrow="Under the hood" title="Real retrieval, a real agent, real tests">
                The live demo has no model key configured, so it runs in extractive mode: drafts quote the matching policy
                instead of writing prose, and the workspace says so. Add a Gemini key or a local Ollama model for generated replies.
              </SectionHead>
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {STACK.map(({ icon: Icon, title, items }, i) => (
                  <div key={title} className="reveal edge-light rounded-[var(--radius-panel)] bg-surface p-5 transition-transform duration-300 hover:-translate-y-1" style={delay(i * 70)}>
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-[10px] bg-accent-wash text-accent"><Icon className="size-[18px]" aria-hidden /></span>
                      <h3 className="font-display text-[1.1rem] text-fg">{title}</h3>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {items.map((it) => (
                        <li key={it} className="flex gap-2 text-[14px] text-fg-soft"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="relative overflow-hidden border-t border-line">
            <div aria-hidden className="pointer-events-none absolute bottom-[-55%] left-1/2 h-[600px] w-[900px] max-w-[180vw] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(42_98_236/0.35),transparent)]" />
            <div className="relative mx-auto max-w-[1240px] px-4 py-24 text-center sm:px-8 lg:py-32">
              <h2 className="reveal font-display mx-auto max-w-3xl text-section text-fg">
                Run the agent on a real ticket from the <span className="font-editorial text-gradient pr-1">demo queue.</span>
              </h2>
              <p className="reveal mx-auto mt-5 max-w-xl text-lead text-fg-soft" style={delay(80)}>
                Try the cracked dinner plates, the order that never arrived, or the customer who claims to be the store manager.
              </p>
              <div className="reveal mt-9 flex flex-wrap justify-center gap-3" style={delay(160)}>
                <ButtonLink href="/login" size="lg">Open the demo workspace</ButtonLink>
                <ButtonLink href={REPO} variant="secondary" size="lg">Read the source</ButtonLink>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-fg-faint">
                A portfolio project. Halden &amp; Co. and every customer in the demo are fictional, and the demo resets when its server restarts.
              </p>
            </div>
            <FooterCol title="Product" links={[["#product", "Workspace"], ["#how", "Workflow"], ["#limits", "Guardrails"], ["#stack", "Under the hood"]]} />
            <FooterCol title="Demo" links={[["/login", "Sign in"], [REPO, "Source on GitHub"]]} />
          </div>
          <div className="border-t border-line">
            <p className="mx-auto max-w-[1240px] px-4 py-5 text-[12.5px] text-fg-faint sm:px-8">© {new Date().getFullYear()} SupportIQ. Built with FastAPI, LangGraph and Next.js.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="reveal max-w-2xl">
      <p className="eyebrow text-accent!">{eyebrow}</p>
      <h2 className="font-display mt-4 text-section text-fg">{title}</h2>
      {children && <p className="mt-5 text-lead text-fg-soft">{children}</p>}
    </div>
  );
}

function Pillar({ i, icon, title, children }: { i: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="reveal group relative pt-6" style={delay(i * 90)}>
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-line-strong" />
      <span aria-hidden className="absolute top-0 left-0 h-px w-16 bg-accent shadow-[0_0_14px_rgb(91_140_255/0.9)] transition-[width] duration-500 group-hover:w-full" />
      <div className="flex items-center gap-3 text-accent">
        {icon}
        <h3 className="font-display text-[1.3rem] text-fg">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-fg-soft">{children}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([href, label]) => (
          <li key={href}>
            {href.startsWith("http") ? (
              <a href={href} className="text-[14px] text-fg-soft transition-colors hover:text-fg" target="_blank" rel="noreferrer">{label}</a>
            ) : (
              <Link href={href} className="text-[14px] text-fg-soft transition-colors hover:text-fg">{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Illustration of the real workspace showing seeded demo tickets after an agent run. Static
   markup (no data fetching) so it renders instantly; the live version is behind sign-in. */
const PREVIEW_TICKETS = [
  { name: "Daniel Reyes", subject: "Plates arrived cracked", status: "Awaiting approval", active: true },
  { name: "Grace Liu", subject: "Store manager refund authorisation", status: "Escalated" },
  { name: "Tom Whitfield", subject: "Cancel my order please", status: "Open" },
  { name: "Aiko Tanaka", subject: "Duvet cover still hasn’t arrived", status: "Open" },
];

function ProductPreview() {
  return (
    <figure>
      <div className="relative">
        <div aria-hidden className="absolute -inset-x-6 -top-10 bottom-10 rounded-[40px] bg-[radial-gradient(60%_50%_at_50%_0%,rgb(42_98_236/0.25),transparent_70%)] blur-2xl" />
        <div className="edge-light relative overflow-hidden rounded-[18px] border border-line-strong bg-surface shadow-[var(--shadow-float)]">
          {/* Window chrome */}
          <div className="flex h-10 items-center gap-2 border-b border-line bg-raised/70 px-4">
            <span className="size-2.5 rounded-full bg-line-strong" /><span className="size-2.5 rounded-full bg-line-strong" /><span className="size-2.5 rounded-full bg-line-strong" />
            <span className="ml-3 truncate text-[12px] text-fg-faint">supportiq · Inbox</span>
          </div>
          <div className="grid md:grid-cols-[250px_1fr] lg:grid-cols-[250px_1fr_270px]">
            {/* Ticket list */}
            <ul className="hidden border-r border-line md:block">
              {PREVIEW_TICKETS.map((t) => (
                <li key={t.subject} className={clsx("relative border-b border-line/70 px-4 py-3", t.active && "bg-raised")}>
                  {t.active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-accent shadow-[0_0_12px_rgb(91_140_255/0.8)]" />}
                  <p className="text-[12px] text-fg-faint">{t.name}</p>
                  <p className="mt-0.5 truncate text-[13.5px] font-medium text-fg">{t.subject}</p>
                  <span className={clsx("mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                    t.status === "Escalated" ? "bg-brick-wash text-brick" : t.status === "Open" ? "bg-accent-wash text-accent-bright" : "bg-amber-wash text-amber")}>{t.status}</span>
                </li>
              ))}
            </ul>

            {/* Conversation + draft */}
            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="text-[12px] text-fg-faint">From Daniel Reyes via email, order HC-10433</p>
                <p className="font-display mt-1 text-[1.3rem] text-fg">Plates arrived cracked</p>
              </div>
              <blockquote className="rounded-[12px] border border-line-strong bg-raised px-4 py-3 text-[14px] leading-relaxed text-fg-soft">
                “My Tidal dinner set arrived yesterday and two of the dinner plates are cracked straight through. Order HC-10433.”
              </blockquote>
              <div className="rounded-[12px] border border-accent/35 bg-accent-wash/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-bright"><Bot className="size-3.5" aria-hidden /> Draft reply</p>
                  <span className="rounded-full bg-moss-wash px-2 py-0.5 text-[11px] font-medium text-moss">Citations verified</span>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-fg">
                  Hi Daniel, I’m sorry your plates arrived damaged. Because you let us know within 14 days of delivery, you can choose a
                  free replacement or a full refund, and there’s no return shipping to pay
                  <sup className="ml-0.5 rounded bg-accent-wash px-1 text-[10.5px] font-semibold text-accent-bright">RR-3</sup>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-accent-fill px-3 text-[12.5px] font-medium text-on-accent"><Check className="size-3.5" aria-hidden /> Approve and send</span>
                  <span className="inline-flex h-8 items-center rounded-[8px] border border-line-strong bg-raised px-3 text-[12.5px] text-fg">Approve refund of $142.00</span>
                </div>
              </div>
            </div>

            {/* Evidence + timeline */}
            <div className="hidden space-y-4 border-l border-line p-5 lg:block">
              <div>
                <p className="eyebrow">Evidence</p>
                <p className="mt-2 rounded-[10px] border border-line bg-raised p-3 text-[12.5px] leading-snug text-fg-soft">
                  <span className="font-medium text-fg">Returns &amp; Refunds Policy</span><br />RR-3 Damaged or defective on arrival
                </p>
              </div>
              <div>
                <p className="eyebrow">Rule check</p>
                <p className="mt-2 rounded-[10px] border border-moss/25 bg-moss-wash/50 p-3 text-[12.5px] leading-snug text-fg-soft">
                  Reported 5 days after delivery, within the 14-day window
                </p>
              </div>
              <div>
                <p className="eyebrow">Agent trail</p>
                <ol className="mt-2 space-y-2">
                  {["load_context", "classify", "plan_tools", "lookup_order", "search_kb", "check_eligibility", "draft_reply", "decide"].map((s) => (
                    <li key={s} className="flex items-center gap-2 text-[12.5px] text-fg-soft">
                      <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(91_140_255/0.9)]" aria-hidden />
                      <code className="font-mono text-[12px]">{s}</code>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[12.5px] text-fg-faint">
        Illustration of a seeded demo ticket after an agent run. The live version is in the workspace.
      </figcaption>
    </figure>
  );
}
