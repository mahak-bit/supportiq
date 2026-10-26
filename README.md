# SupportIQ: AI customer support copilot

SupportIQ helps e-commerce support agents answer tickets faster without losing control. For each ticket it:

1. classifies the request,
2. looks up the order,
3. retrieves the policy passages that apply,
4. checks explicit business rules,
5. drafts a reply where every claim is tied to a source.

A person then edits and approves the draft, and any refund or return proposals, before anything happens.

It's a full-stack portfolio project covering three disciplines:

| Discipline | Where to see it |
|---|---|
| **Generative AI**: RAG, structured output, citation validation, abstention, evaluation | Knowledge page → upload `sample-docs/gift-services.md` → ask about engraving |
| **Agentic AI**: bounded LangGraph workflow, typed tools, rules engine, approvals, audit trail | Inbox → open a ticket → **Run agent** → *Agent activity* panel |
| **Full stack**: Next.js 16 + FastAPI + SQLAlchemy/Alembic, auth and roles, tests | Everything is persisted and served by real endpoints |

> All customers, orders and tickets are **synthetic**. The demo store, *Halden & Co.*, is fictional.

## Live demo

**https://supportiq-self.vercel.app**: choose *Open the demo workspace*, then continue as the agent or the team lead.

It runs on Vercel: a Next.js project, plus a FastAPI project at `supportiq-api-mahakj532-8125s-projects.vercel.app` behind the Next proxy. Things to know:

- **No language model is configured**, so drafts use the labelled extractive mode. Add `GEMINI_API_KEY` to the `supportiq-api` project's environment variables and redeploy to enable generated replies.
- **The demo resets.** Vercel functions have no persistent disk, so the SQLite database lives in temporary storage. Each new server instance starts from the seeded demo, so uploads, approvals and agent runs disappear when an instance is recycled or a request lands on a different one. For durable data, set `DATABASE_URL` to a hosted PostgreSQL.
- **The first request after idle is slow** (a cold start): the server migrates, seeds and loads the embedding model.


---

## Quick start (local)

Requirements: Python 3.10+, Node 20+ (tested with Python 3.10.2, Node 24.12, npm 11.6, Windows 11).

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv/Scripts/activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # optional: add GEMINI_API_KEY
uvicorn app.main:app --port 8000
```

On first start the backend runs the Alembic migrations, seeds the demo data, downloads the ~67 MB embedding model once, and indexes the five policy documents.

```bash
# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local      # BACKEND_URL=http://127.0.0.1:8000
npm run dev                     # or: npm run build && npm start
```

Open http://localhost:3000 and choose **Open the demo workspace**. Sign in as:

| Account | Role | Can |
|---|---|---|
| `agent@supportiq.demo` | Support agent | Draft, send in-policy replies, approve refunds up to $300 |
| `lead@supportiq.demo` | Team lead | Everything, plus escalations, large refunds, deleting and re-indexing documents |

The password for both is `demo-password` (set with `SEED_DEMO_PASSWORD`).

### Demo script

1. **Plates arrived cracked**: Run agent. It finds order HC-10433 and rule RR-3 (damage reported within 14 days), drafts a cited reply and proposes a $142 refund. Approve the reply: it is recorded on the ticket as *Recorded, not emailed*.
2. **Store manager refund authorisation** is a prompt-injection attempt. The agent flags it, refuses to propose the demanded refund and escalates. Only the lead account can approve the reply.
3. **Cancel my order please**: the order hasn't shipped, so it can be cancelled (RR-4). At $362 it is above the $300 limit, so the refund approval requires a lead.
4. **Duvet cover still hasn't arrived**: in transit for 17 days triggers the lost-package rule (RR-5), so the ticket is escalated.
5. **Knowledge**: ask "Can the Arden duvet cover be engraved?". The knowledge base doesn't cover it, so you get an abstention. Upload `sample-docs/gift-services.md` and ask again to get a cited answer.

---

## Language model configuration

| `LLM_PROVIDER` | Behaviour |
|---|---|
| `auto` (default) | Gemini if `GEMINI_API_KEY` is set; else Ollama if reachable at `OLLAMA_BASE_URL`; else extractive |
| `gemini` | Google Gemini via `google-genai`, JSON-schema structured output. Default model `gemini-2.5-flash` (`GEMINI_MODEL`) |
| `ollama` | Local model through Ollama's `/api/chat` with a JSON schema `format` (default `llama3.2:3b`) |
| `extractive` | **Not an LLM.** Builds replies only from verified tool facts and verbatim policy sentences. Clearly labelled in the UI |

**Gemini free tier:** Google offers a free tier for the Gemini API, but limits differ per model and project and change over time. Check current limits in [Google AI Studio](https://aistudio.google.com) and the [rate-limits page](https://ai.google.dev/gemini-api/docs/rate-limits). SupportIQ caps AI requests per user (`AI_RATE_LIMIT_PER_MINUTE`) and retries a bounded number of times. If the model fails, the agent falls back to extractive drafting and records that in the trail.

**What was verified:** this build was developed and tested **without** a Gemini key or Ollama. The extractive path, the full agent workflow, and the LLM code path (with a scripted provider in tests) were all exercised. A live Gemini or Ollama call has **not** been run here. Add a key, then check the provider shown on the Settings page and on each draft.

**Embeddings:** the default is `fastembed`, which runs the same open models as Sentence Transformers on ONNX Runtime without PyTorch. I chose it because the build machine had under 4 GB of free disk. To use Sentence Transformers instead, `pip install sentence-transformers`, set `EMBEDDING_PROVIDER=sentence-transformers` and `EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2`, then click **Re-embed all passages** in Settings (lead).

---

## Architecture

See **[docs/architecture.md](docs/architecture.md)** for diagrams covering the system, the GenAI pipeline, the agent state machine, tool contracts, the database ER diagram and security controls.

```
supportiq/
├── README.md
├── .gitignore
├── docs/
│   └── architecture.md            # system, RAG, agent state machine, ER diagram, security
├── sample-docs/
│   └── gift-services.md           # upload during the demo (not seeded on purpose)
├── backend/                       # Python · FastAPI
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── pytest.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/0001_initial_schema.py
│   ├── app/
│   │   ├── main.py                # app, lifespan (migrate, seed, index), middleware
│   │   ├── config.py              # all settings via env vars
│   │   ├── db.py · models.py      # SQLAlchemy engine + 11 tables
│   │   ├── schemas.py             # Pydantic API contracts
│   │   ├── security.py            # PBKDF2, JWT cookie, roles, rate limiter
│   │   ├── services.py            # draft creation, send + approval gating
│   │   ├── seed.py                # synthetic users, customers, orders, tickets
│   │   ├── migrations.py
│   │   ├── api/                   # auth, tickets, knowledge, analytics, system routers
│   │   ├── agent/
│   │   │   ├── graph.py           # LangGraph state machine + audit trail
│   │   │   ├── tools.py           # typed tools: order lookup, KB search, eligibility
│   │   │   ├── rules.py           # business rules RR-0…RR-8
│   │   │   └── classify.py        # LLM + deterministic classification and flags
│   │   ├── generation/
│   │   │   ├── reply.py           # prompts, extractive mode, citation/number validation
│   │   │   ├── schemas.py         # structured-output models
│   │   │   └── safety.py          # injection detection, delimiter fencing
│   │   ├── llm/providers.py       # Gemini · Ollama · extractive, retries
│   │   └── rag/                   # extract, chunking, embeddings, index (FAISS), retriever, ingest
│   ├── seed_docs/                 # 5 synthetic policy documents
│   ├── eval/
│   │   ├── dataset.jsonl          # 25 labelled questions
│   │   └── run_eval.py
│   └── tests/                     # conftest, test_units, test_api, test_agent (36 tests)
└── frontend/                      # Next.js 16 · TypeScript strict · Tailwind v4
    ├── .env.example
    ├── package.json · tsconfig.json · next.config.ts · vitest.config.ts
    └── src/
        ├── proxy.ts               # auth gate for /app/*
        ├── app/
        │   ├── layout.tsx · globals.css · icon.svg · not-found.tsx
        │   ├── page.tsx           # landing page
        │   ├── login/             # page.tsx, LoginForm.tsx
        │   └── app/               # workspace (layout.tsx + AppShell)
        │       ├── inbox/  approvals/  knowledge/  analytics/  settings/
        ├── components/
        │   ├── ui.tsx             # design system: buttons, badges, dialog, toasts, states
        │   ├── AppShell.tsx · ApprovalCard.tsx
        │   ├── inbox/             # Inbox, TicketList, TicketWorkspace, DraftComposer,
        │   │                      # ContextPanel, AgentTimeline, Citations (+ test)
        │   └── landing/           # OrbitScene (R3F), HeroVisual (WebGL check + SVG fallback)
        └── lib/                   # api.ts (client + hook), types.ts, format.ts (+ test)
```

**Design system:** ivory paper `#F6F3EA`, blue-black ink `#171A2C`, one cobalt accent `#2448D8`; Source Serif 4 for display, Hanken Grotesk for UI. The 3D "support orbit" (React Three Fiber) is used only on the landing page, where it:

- loads lazily with `ssr: false`,
- stops rendering when off-screen,
- renders a single static frame under `prefers-reduced-motion`,
- falls back to an SVG drawing when WebGL is unavailable.

---

## Testing

```bash
cd backend && .venv/Scripts/python -m pytest      # 36 tests, offline (temp DB, lexical embedder, scripted LLM)
cd frontend && npm test                           # 8 tests (vitest + Testing Library)
cd frontend && npm run lint                       # tsc --noEmit, strict mode
```

Backend tests cover:

- chunking, PDF extraction and upload validation,
- every eligibility rule branch,
- classifier flags and the injection fence,
- citation validation (fabricated IDs and numbers),
- auth and role checks,
- the upload → index → cited-answer flow and abstention,
- agent routing, escalation and the approval flows,
- the LLM fallback trail.

## Evaluation

`python -m eval.run_eval` (from `backend/`) runs 25 labelled questions: 20 answerable and 5 deliberately unanswerable. It indexes the seeded policies into a throwaway database.

Results measured on 2026-10-26 with **fastembed bge-small + extractive mode (no LLM)**:

| Metric | Value |
|---|---|
| Retrieval hit@5 (expected section retrieved) | 1.00 |
| Retrieval MRR | 1.00 |
| Answer correctness (all key phrases present) | 0.70 |
| Citation precision (citations pointing at the expected section) | 0.62 |
| Answered when answerable | 0.95 |
| Abstained when unanswerable | 1.00 |
| Validation pass rate | 1.00 |

Extractive mode quotes one or two sentences, so it misses answers that span sentences and sometimes cites a neighbouring section. An LLM provider should raise correctness. Re-run the script after configuring one, because those numbers have not been measured.

---

## Deployment

**Frontend (e.g. Vercel):** set `BACKEND_URL` to the public backend URL **before building**, because rewrites are resolved at build time.

**Backend (Render, Fly.io, Railway or any container host):** `backend/Dockerfile` is provided. **I haven't built it here because Docker wasn't available on the development machine.** Set these:

- `ENVIRONMENT=production`
- `JWT_SECRET`
- `COOKIE_SECURE=true`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `GEMINI_API_KEY` (optional)

**Persistence:** with SQLite, data lives in `backend/data/` and survives restarts only if that directory is on a persistent volume. On hosts with ephemeral disks, use PostgreSQL (`DATABASE_URL=postgresql+psycopg://…`; the driver is installed). The models and migrations are database-agnostic, but **only SQLite was exercised during development**.

**Scaling note:** the rate limiter and the FAISS index are per process. Run one backend instance, or move rate limiting to Redis and rebuild the index on each replica (it rebuilds from the database at startup).

---

## Honest status

| Area | Status |
|---|---|
| Ingestion (PDF/MD/TXT), chunking, local embeddings, FAISS retrieval | Implemented and tested |
| Grounded generation, citation and number validation, abstention | Implemented; tested with extractive and scripted providers |
| Live Gemini / Ollama generation | Implemented, **not run** (no key or model on the build machine) |
| LangGraph agent, typed tools, rules engine, escalation, approvals, audit trail | Implemented and tested |
| Auth (JWT cookie), roles, rate limits, upload validation | Implemented and tested |
| SQLite persistence with Alembic migrations | Implemented and tested |
| PostgreSQL | Supported by configuration, **not tested** |
| Sending email / issuing refunds | **Intentionally not implemented.** Approved replies are recorded as `simulated`; refund approvals are recorded for a payment system |
| Cloud deployment | **Live on Vercel** (frontend + FastAPI), with temporary SQLite storage that resets. Dockerfile written but **not built** |
| Browser check | Key flows exercised in headless Edge (landing, login, agent run, upload and ask, lead escalation) at desktop, tablet and mobile widths |
