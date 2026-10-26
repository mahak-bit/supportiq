# SupportIQ architecture

## System overview

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js App Router UI<br/>landing · inbox · knowledge · analytics · settings]
  end
  subgraph Next[Next.js server]
    RW[/api/* rewrite proxy<br/>+ proxy.ts auth gate/]
  end
  subgraph API[FastAPI backend]
    R[Routes<br/>auth · tickets · knowledge · analytics · system]
    S[Services<br/>drafts · approvals · send gating]
    AG[Agent<br/>LangGraph state machine]
    GEN[Generation<br/>prompting · structured output · citation validation]
    RAG[RAG<br/>extract · chunk · embed · FAISS]
    LLM[LLM provider abstraction<br/>Gemini · Ollama · extractive]
  end
  DB[(SQLite / PostgreSQL<br/>via SQLAlchemy + Alembic)]
  EMB[[fastembed ONNX<br/>bge-small-en-v1.5]]
  GEM[(Gemini API)]
  OLL[(Ollama, local)]

  UI -- same-origin fetch, httpOnly cookie --> RW --> R
  R --> S --> AG
  AG --> GEN --> LLM
  AG --> RAG
  R --> RAG
  RAG --> EMB
  LLM -.optional.-> GEM
  LLM -.optional.-> OLL
  R & S & AG & RAG --> DB
```

The browser only talks to the Next.js origin. `/api/*` is rewritten to FastAPI on the server, so the session cookie is first-party and no backend URL or credential reaches client code. FAISS is an in-memory accelerator rebuilt from embeddings stored in the `chunks` table, so the index can't drift from the database.

## GenAI pipeline

```mermaid
flowchart TB
  U[Upload PDF / MD / TXT] --> V{Validate<br/>extension, magic bytes,<br/>size ≤ 10 MB, sha256 dedupe}
  V -- invalid --> E[422/409/413 with a clear message]
  V --> X[Extract text<br/>PyMuPDF, page numbers kept]
  X --> C[Chunk: heading-aware,<br/>~900 chars, 150 overlap]
  C --> EM[Embed passages<br/>bge-small, normalised]
  EM --> ST[(chunks table<br/>text + section + page + vector)]
  ST --> IX[FAISS IndexFlatIP rebuild]
  Q[Question / ticket] --> QE[Embed query] --> IX --> TH{score ≥ min_score?}
  TH -- none --> H[Holding reply,<br/>insufficient_evidence = true]
  TH -- passages --> P[Prompt: fixed system rules +<br/>fenced untrusted evidence + verified facts]
  P --> M[LLM, JSON schema output:<br/>reply, claims with source_ids,<br/>insufficient_evidence, confidence]
  M --> VAL[Validate: every cited ID ∈ retrieved ∪ facts,<br/>every claim has a source,<br/>every number appears in evidence]
  VAL --> D[Draft + citations + validation report<br/>shown to the human reviewer]
```

## Agent state machine

```mermaid
stateDiagram-v2
  [*] --> load_context
  load_context --> classify
  classify --> plan_tools
  plan_tools --> lookup_order: intent needs order data
  plan_tools --> search_kb: otherwise
  lookup_order --> search_kb
  search_kb --> check_eligibility: order found and refund/return/damage,<br/>or delivery question while in transit
  search_kb --> draft_reply: otherwise
  check_eligibility --> draft_reply
  draft_reply --> decide
  decide --> [*]: escalate, or request approval
```

| Node | Tool | Typed input → output | Notes |
|---|---|---|---|
| load_context | `get_ticket_context` | ticket id → messages, customer, linked order id | |
| classify | `classify_ticket` | subject + message → `TicketClassification` | LLM + deterministic flags; model-extracted order IDs discarded unless found verbatim by regex |
| plan_tools | — | classification → tool list + rationale | deterministic policy, recorded |
| lookup_order | `lookup_order` | `OrderLookupInput{order_id ^HC-\d{5}$, customer_id}` → `OrderLookupOutput` | refuses orders belonging to other customers |
| search_kb | `search_knowledge_base` | `KBSearchInput{query, k≤10}` → `KBSearchOutput` | threshold-filtered |
| check_eligibility | `check_eligibility` | `EligibilityInput{order, intent, as_of}` → `Eligibility` | pure rules RR-0…RR-8 |
| draft_reply | `generate_grounded_reply` | evidence + facts + tone → draft + validation | falls back to extractive if the model fails |
| decide | `request_approval` | state → decision + `ApprovalRequest` rows | never sends, never refunds |

Bounds: fixed graph (no loops), `recursion_limit=20`, 120 s run budget checked before every node, LLM calls with HTTP timeouts and at most `LLM_MAX_RETRIES` retries with backoff, every node wrapped so an exception becomes an `error` step plus escalation instead of a crash.

Escalation triggers: sensitive flags (legal threat, chargeback, safety, privacy, harassment, prompt injection), insufficient evidence, failed citation/number validation, lost-package investigation, or a request outside policy. Escalated runs create only a `send_reply` approval that requires the **lead** role; refund approvals are proposed only for in-policy cases, and require a lead above $300.

## Database schema

```mermaid
erDiagram
  users ||--o{ drafts : "created/approved"
  customers ||--o{ orders : places
  customers ||--o{ tickets : opens
  orders |o--o{ tickets : "linked to"
  tickets ||--o{ messages : contains
  tickets ||--o{ drafts : has
  tickets ||--o{ agent_runs : has
  agent_runs ||--o{ agent_steps : records
  tickets ||--o{ approval_requests : needs
  agent_runs |o--o{ approval_requests : proposes
  drafts |o--o{ approval_requests : "send_reply for"
  knowledge_documents ||--o{ chunks : "split into"
```

Key columns: `messages.delivery` (`simulated` for approved replies: there is no email integration), `drafts.original_body` vs `body` (measures human edits), `drafts.validation` (JSON report), `chunks.embedding` (float32 bytes), `approval_requests.required_role`, `tickets.is_synthetic` / `customers.is_synthetic`.

## Security controls

- **Auth:** PBKDF2-SHA256 (240k iterations) password hashes; HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` via `COOKIE_SECURE`); `JWT_SECRET` mandatory in production.
- **Authorization:** roles `agent` < `lead`, enforced server-side for deleting/re-indexing documents, resolving escalated tickets, approving escalated replies and refunds above the threshold.
- **Prompt-injection defence:** fixed system prompt; customer text and documents wrapped in delimiters with our own tags neutralised; schema-constrained output; injection heuristics flag and escalate; the model has no tools that act externally.
- **Hallucination controls:** relevance threshold, citation-ID validation, unsupported-claim and unverified-number detection, insufficient-evidence abstention.
- **Abuse protection:** per-user AI rate limit, per-IP login rate limit, upload size cap read without buffering beyond the limit, magic-byte checks, request-body validation via Pydantic.
- **Logging:** method, path, status and duration only; no bodies, cookies, query strings or keys.
- **Secrets:** only in backend environment; `/api/system/status` reports presence, never values.
