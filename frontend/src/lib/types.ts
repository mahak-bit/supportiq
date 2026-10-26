// Mirrors backend/app/schemas.py. Keep in sync when the API contract changes.

export type TicketStatus = "open" | "pending" | "escalated" | "resolved";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Tone = "friendly" | "empathetic" | "concise" | "professional";
export type Role = "agent" | "lead";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface CustomerBrief {
  id: number;
  name: string;
  email: string;
  tier: "standard" | "plus";
}

export interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  price_cents: number;
  final_sale: boolean;
}

export interface Order {
  id: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  placed_at: string;
  delivered_at: string | null;
  total_cents: number;
  refunded_cents: number;
  currency: string;
  items: OrderItem[];
  payment_method: string;
}

export interface TicketBrief {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  category: string;
  created_at: string;
}

export interface Customer extends CustomerBrief {
  country: string;
  note: string;
  is_synthetic: boolean;
  created_at: string;
  orders: Order[];
  previous_tickets: TicketBrief[];
}

export interface Message {
  id: number;
  author_type: "customer" | "agent" | "system";
  author_name: string;
  body: string;
  is_internal: boolean;
  delivery: string;
  created_at: string;
}

export interface TicketListItem {
  id: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  category: string;
  channel: string;
  created_at: string;
  updated_at: string;
  is_synthetic: boolean;
  customer: CustomerBrief;
  order_id: string | null;
  preview: string;
  message_count: number;
  pending_approvals: number;
}

export interface TicketList {
  items: TicketListItem[];
  total: number;
  counts: Record<string, number>;
}

export interface PassageCitation {
  id: string;
  kind: "passage";
  document_id: number;
  document_title: string;
  section: string;
  page: number | null;
  excerpt: string;
  score: number;
}

export interface FactCitation {
  id: string;
  kind: "fact";
  label: string;
  excerpt: string;
}

export type Citation = PassageCitation | FactCitation;

export interface Validation {
  passed: boolean;
  invalid_citation_ids: string[];
  unsupported_claims: string[];
  unverified_numbers: string[];
  ungrounded: boolean;
  retrieved_ids: string[];
  fact_ids: string[];
}

export interface Draft {
  id: number;
  ticket_id: number;
  agent_run_id: number | null;
  body: string;
  original_body: string;
  tone: Tone;
  provider: string;
  model: string;
  citations: Citation[];
  validation: Validation | Record<string, never>;
  insufficient_evidence: boolean;
  confidence: "low" | "medium" | "high";
  status: "draft" | "sent" | "discarded";
  created_at: string;
  approved_at: string | null;
}

export interface AgentStep {
  id: number;
  ordinal: number;
  node: string;
  tool: string;
  status: "ok" | "skipped" | "error";
  summary: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  attempts: number;
  duration_ms: number;
  started_at: string;
}

export interface Classification {
  intent?: string;
  category?: string;
  urgency?: Priority;
  sentiment?: string;
  order_id?: string | null;
  sensitive_flags?: string[];
  summary?: string;
  method?: string;
  injection_signals?: string[];
}

export interface AgentRun {
  id: number;
  ticket_id: number;
  status: "running" | "awaiting_approval" | "escalated" | "completed" | "failed";
  decision: string;
  decision_reason: string;
  classification: Classification;
  final_state: Record<string, unknown>;
  provider: string;
  error: string;
  started_at: string;
  finished_at: string | null;
  steps: AgentStep[];
}

export interface Approval {
  id: number;
  ticket_id: number;
  run_id: number | null;
  draft_id: number | null;
  kind: "send_reply" | "refund" | "return_label";
  summary: string;
  payload: Record<string, unknown>;
  required_role: Role;
  status: "pending" | "approved" | "rejected";
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
  ticket_subject: string;
}

export interface TicketDetail extends TicketListItem {
  escalation_reason: string;
  first_response_at: string | null;
  resolved_at: string | null;
  messages: Message[];
  customer_profile: Customer;
  order: Order | null;
  drafts: Draft[];
  latest_run: AgentRun | null;
  approvals: Approval[];
}

export interface KnowledgeDocument {
  id: number;
  title: string;
  filename: string;
  mime: string;
  size_bytes: number;
  status: "queued" | "processing" | "indexed" | "failed";
  error: string;
  chunk_count: number;
  page_count: number;
  source: "seed" | "upload";
  embedding_model: string;
  created_at: string;
  indexed_at: string | null;
}

export interface Chunk {
  id: string;
  ordinal: number;
  text: string;
  section: string;
  page: number | null;
}

export interface DocumentDetail extends KnowledgeDocument {
  chunks: Chunk[];
}

export interface Passage {
  chunk_id: string;
  document_id: number;
  document_title: string;
  section: string;
  page: number | null;
  text: string;
  score: number;
  above_threshold: boolean;
}

export interface SearchResult {
  query: string;
  threshold: number;
  results: Passage[];
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  validation: Validation;
  insufficient_evidence: boolean;
  confidence: string;
  provider: string;
  model: string;
  retrieved: Passage[];
}

export interface Analytics {
  window_days: number;
  generated_at: string;
  provenance: { tickets_total: number; tickets_synthetic: number; note: string };
  totals: {
    created: number;
    resolved: number;
    open_now: number;
    escalated_now: number;
    median_first_response_minutes: number | null;
    median_resolution_hours: number | null;
  };
  series: { date: string; created: number; resolved: number }[];
  categories: { category: string; count: number; median_resolution_hours: number | null }[];
  priorities: Record<string, number>;
  agent: {
    runs: number;
    decisions: Record<string, number>;
    approvals: Record<string, number>;
    drafts_generated: number;
    drafts_sent: number;
    drafts_edited_before_send: number;
    validation_pass_rate: number | null;
    insufficient_evidence_drafts: number;
  };
}

export interface SystemStatus {
  workspace: { company_name: string; environment: string };
  llm: {
    active_provider: string;
    active_model: string;
    is_llm: boolean;
    configured_provider: string;
    gemini_key_present: boolean;
    gemini_model: string;
    ollama_reachable: boolean;
    ollama_model: string;
    timeout_seconds: number;
    max_retries: number;
  };
  retrieval: {
    embedding: string;
    index_backend: string;
    indexed_chunks: number;
    top_k: number;
    min_score: number;
    chunk_size: number;
    chunk_overlap: number;
  };
  storage: { dialect: string; persistent: boolean; note: string };
  limits: { max_upload_mb: number; ai_requests_per_minute: number; refund_lead_approval_threshold: number };
  counts: { documents: number; chunks: number; tickets: number };
}
