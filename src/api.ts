// Frontend <-> Rust bridge.
// Under Tauri, calls go to real Rust commands (src-tauri/src/lib.rs).
// In a plain browser (vite dev without Tauri) work items fall back to
// localStorage and the Loom calls go through the /api/loom dev proxy
// (see vite.config.ts). There is no demo data anywhere: when the Loom
// server is not reachable, the calls fail and the UI says so.

import { invoke } from "@tauri-apps/api/core";

/// The four autonomy levels, least to most permissive. Mirrors the backend.
export const AUTONOMY_LEVELS: IntentAutonomy[] = [
  "manual",
  "assisted",
  "collaborative",
  "delegated",
];

/// A record of an autonomy change: from what level, to what level,
/// with optional justification (required when raising).
export interface AutonomyChange {
  from: string;
  to: string;
  justification: string | null;
  at: number;
}

export interface WorkItem {
  id: string;
  title: string;
  status: "active" | "paused";
  autonomy: "manual" | "assisted" | "collaborative" | "delegated";
  updated_label: string;
  // Unix seconds of the last mutation (0 for items written before the
  // backend tracked it). The UI renders relative time from this; the
  // label above is legacy.
  updated_at: number;
  // The Loom session associated with this work item (if any).
  session_id?: string | null;
  // The intent this work belongs to (if any).
  intent_id?: string | null;
  success_criteria?: string[];
  artifact_ids?: string[];
  /// History of autonomy changes for this work item, oldest first.
  autonomy_history?: AutonomyChange[];
}

export interface AcceptanceCriterion {
  text: string;
  done: boolean;
}

export interface IntentVersion {
  version: number;
  statement: string;
  why?: string | null;
  acceptance: AcceptanceCriterion[];
  updated_at: number;
}

export type IntentAutonomy = "manual" | "assisted" | "collaborative" | "delegated";

export interface Intent {
  id: string;
  statement: string;
  why?: string | null;
  acceptance: AcceptanceCriterion[];
  autonomy: IntentAutonomy;
  status: "active" | "done";
  version: number;
  history: IntentVersion[];
  created_at: number;
  updated_at: number;
  /// History of autonomy changes, oldest first.
  autonomy_history: AutonomyChange[];
}

export interface IntentsList {
  active_intent_id: string | null;
  intents: Intent[];
}

export interface AttentionItem {
  id: string;
  kind: "decision" | "finding";
  title: string;
  detail: string;
}

/// Provenance label for a piece of evidence: what kind of claim it rests on.
/// Distinguishes what the system observed from what it merely inferred,
/// so explanations are never mistaken for ground truth (P3).
export type EvidenceKind = "observed" | "recorded" | "inferred" | "unknown";

/// Human-readable label for each evidence kind badge.
export function evidenceKindLabel(kind: EvidenceKind): string {
  switch (kind) {
    case "observed":
      return "Observed";
    case "recorded":
      return "Recorded";
    case "inferred":
      return "Inferred";
    case "unknown":
      return "Unknown";
  }
}

export interface LoomStatus {
  online: boolean;
  url: string;
  detail: string;
}

export interface ChatCard {
  title: string;
  detail: string;
}

export interface ChatReply {
  text: string;
  // The backend only ever sends "live". There is no demo reply.
  source: "live";
  card: ChatCard | null;
  // Set when the server reports which session the reply belongs to.
  session_id?: string | null;
  // Provenance of the reply's content: what kind of claim it rests on.
  // Defaults to "unknown" when the server does not report one.
  evidenceKind?: EvidenceKind;
  // The trace id the server reports when tracing is enabled — the
  // handle for the observability surface (GetTrace).
  trace_id?: string | null;
  // The turn's cost from the server's CostInfo (USD). Missing means
  // unknown — never treated as zero.
  cost_usd?: number | null;
}

/// One WeaveProgress event from POST /v1/weave:stream, re-emitted by the
/// backend as a Tauri event. Field names follow the Loom proto (snake_case).
export interface WeaveProgressEvent {
  stage?: string | number;
  progress?: number;
  message?: string;
  tool_name?: string;
  partial_content?: string;
  is_token_stream?: boolean;
  token_count?: number;
  is_tool_started?: boolean;
  is_tool_completed?: boolean;
  tool_input?: unknown;
  tool_result?: unknown;
  tool_error?: string;
  tool_success?: boolean;
  tool_call_id?: string;
  hitl_request?: {
    request_id?: string;
    question?: string;
  } | null;
}

export interface LoomStreamEvent {
  requestId: string;
  kind: "progress" | "done" | "error" | "cancelled";
  event?: WeaveProgressEvent;
  error?: string | null;
}

export interface McpServer {
  name: string;
  enabled: boolean;
  connected: boolean;
  transport: string;
  command: string;
  args: string[];
  env: Record<string, unknown>;
  status: string;
  error: string;
  url: string;
}

export interface VaultSignature {
  notes: number;
  pending: number;
  changed_at_ms: number;
}

export interface Session {
  id: string;
  name: string;
  state: string;
  agent_id: string;
  agent_name: string;
  updated_at: number;
  conversation_count: number;
}

export interface Agent {
  id: string;
  name: string;
  status: string;
  error: string;
  uptime_seconds: number;
  active_sessions: number;
  total_messages: number;
  created_at: number;
  updated_at: number;
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
}

export interface HistoryMessage {
  role: string;
  content: string;
}

export interface ExperimentArm {
  id: string;
  label: string;
  config: string;
  status: "defined" | "running" | "done";
  result: string;
}

export interface Experiment {
  id: string;
  title: string;
  question: string;
  hypothesis: string;
  status: "draft" | "running" | "decided";
  arms: ExperimentArm[];
  decision?: string | null;
}

export interface Workflow {
  name: string;
  description: string;
  type: string;
}

export interface WorkflowExecution {
  id: string;
  status: string;
  started_at: number;
  completed_at: number;
  error: string;
  // The run's recorded output, when the server returns it.
  result?: WorkflowResult | null;
}

export interface WorkflowResult {
  pattern_type?: string;
  agent_results?: { agent_id?: string; output?: string }[];
  merged_output?: string;
  duration_ms?: number;
  cost?: number;
  trace_id?: string;
}

export interface ExecuteWorkflowResponse {
  execution_id: string;
  // The run's recorded output, when the server returns it with the
  // execute response.
  result?: WorkflowResult | null;
}

export interface Artifact {
  id: string;
  name: string;
  purpose: string;
  source: string;
  created_at: number;
  // The session that produced this artifact, when the server reports it.
  session_id?: string;
}

/// Detailed session (GET /v1/sessions/{session_id}).
export interface SessionDetail {
  id: string;
  name: string;
  backend: string;
  created_at: number;
  updated_at: number;
  state: string;
  total_cost_usd: number;
  conversation_count: number;
  metadata: Record<string, string>;
  agent_id: string;
  agent_name: string;
  started_at: string;
  ended_at: string;
  metadata_status: string;
  artifact_count: number;
}

/// A tool definition from Loom (GET /v1/tools).
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema_json: string;
  output_schema_json: string;
  backends: string[];
  capabilities: string[];
  keywords: string[];
  category: string;
  providers: string[];
}

/// An LLM model (GET /v1/models).
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  context_window: number;
  cost_per_1m_input_usd: number;
  cost_per_1m_output_usd: number;
  available: boolean;
  max_output_tokens: number;
  is_reasoning: boolean;
  show_in_dropdown: boolean;
}

/// A named LLM provider (GET /v1/providers).
export interface ProviderEntry {
  name: string;
  config: { provider: string; model: string };
  active: boolean;
}

/// Artifact storage statistics (GET /v1/artifacts/stats).
export interface ArtifactStats {
  total_files: number;
  total_size_bytes: number;
  user_files: number;
  generated_files: number;
  deleted_files: number;
}

/// Server configuration (GET /v1/server/config).
export interface ServerConfig {
  name: string;
  network: {
    grpc_address: string;
    http_address: string;
    http_enabled: boolean;
    reflection_enabled: boolean;
  } | null;
  tls: { enabled: boolean; mode: string } | null;
  behavior: {
    max_concurrent_requests: number;
    request_timeout_seconds: number;
    graceful_shutdown: boolean;
    shutdown_timeout_seconds: number;
    cors_enabled: boolean;
    cors_allowed_origins: string[];
  } | null;
  metadata: Record<string, string>;
  storage: { backend: string } | null;
}

/// Storage backend status (GET /v1/server/storage).
export interface StorageStatus {
  backend: string;
  healthy: boolean;
  error: string;
  latency_ms: number;
}

const IN_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isTauri = IN_TAURI;

const LOCAL_KEY = "loom-ide-tauri:work-items";

// Browser fallback persistence: the user's own work items, stored
// locally. Starts empty; nothing is seeded.
function localWorkItems(): WorkItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as WorkItem[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveLocalWorkItems(items: WorkItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch (error) {
    throw new Error(`Could not save work items in this browser: ${String(error)}`);
  }
}

const INTENTS_KEY = "loom-ide-tauri:intents";

// Browser fallback persistence: the user's own intents, stored locally.
// Starts empty; nothing is seeded.
function localIntents(): IntentsList {
  try {
    const raw = localStorage.getItem(INTENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IntentsList;
      if (Array.isArray(parsed.intents)) {
        return {
          active_intent_id: parsed.active_intent_id ?? null,
          intents: parsed.intents,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { active_intent_id: null, intents: [] };
}

function saveLocalIntents(list: IntentsList) {
  try {
    localStorage.setItem(INTENTS_KEY, JSON.stringify(list));
  } catch (error) {
    throw new Error(`Could not save intents in this browser: ${String(error)}`);
  }
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/** Trim criterion text and drop empties, as the backend does. */
function normalizeCriteria(criteria: AcceptanceCriterion[]): AcceptanceCriterion[] {
  return criteria
    .map((c) => ({ text: c.text.trim(), done: c.done }))
    .filter((c) => c.text.length > 0);
}

/** Create an intent in the browser fallback store. Mirrors the backend:
    the first intent becomes the active one. */
function createLocalIntent(
  statement: string,
  why?: string | null,
  acceptance: AcceptanceCriterion[] = [],
  autonomy?: IntentAutonomy | null,
): Intent {
  // Mirror the backend: the statement is required and the level must be
  // one of the four.
  const trimmed = statement.trim();
  if (trimmed === "") throw new Error("Intent statement cannot be empty");
  if (autonomy != null && !AUTONOMY_LEVELS.includes(autonomy)) {
    throw new Error(`Unknown autonomy level: ${autonomy}`);
  }
  const list = localIntents();
  const now = nowUnix();
  const intent: Intent = {
    id: `intent-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    statement: trimmed,
    why: why?.trim() ? why.trim() : null,
    acceptance: normalizeCriteria(acceptance),
    autonomy: autonomy ?? "collaborative",
    status: "active",
    version: 1,
    history: [],
    autonomy_history: [],
    created_at: now,
    updated_at: now,
  };
  list.intents.push(intent);
  if (list.active_intent_id === null) list.active_intent_id = intent.id;
  saveLocalIntents(list);
  return intent;
}

// ---- Commands ----

export async function getWorkItems(): Promise<WorkItem[]> {
  if (!IN_TAURI) return localWorkItems();
  return invoke<WorkItem[]>("get_work_items");
}

export async function addWorkItem(
  title: string,
  intentId?: string | null,
): Promise<WorkItem> {
  if (!IN_TAURI) {
    title = title.trim();
    if (!title) throw new Error("Work item title cannot be empty");
    // Mirror the backend: no work without an intent. An explicit intent
    // wins, then the active one, then a one-line intent from the title.
    // The work inherits the resolved intent's autonomy.
    const list = localIntents();
    let resolvedId = intentId ?? null;
    let resolvedAutonomy: IntentAutonomy = "collaborative";
    if (resolvedId) {
      const explicit = list.intents.find((i) => i.id === resolvedId);
      if (!explicit) throw new Error(`Unknown intent: ${resolvedId}`);
      resolvedAutonomy = explicit.autonomy;
    } else {
      const active = list.intents.find((i) => i.id === list.active_intent_id);
      if (active) {
        resolvedId = active.id;
        resolvedAutonomy = active.autonomy;
      } else {
        resolvedId = createLocalIntent(title).id;
      }
    }
    const items = localWorkItems();
    const item: WorkItem = {
      id: `work-${Date.now()}`,
      title,
      status: "paused",
      autonomy: resolvedAutonomy,
      updated_label: "Now",
      updated_at: nowUnix(),
      intent_id: resolvedId,
    };
    saveLocalWorkItems([item, ...items]);
    return item;
  }
  // Tauri requires the key to be present: an id string, or null when
  // there is no intent to attach. The backend then resolves the active
  // intent, or auto-creates a one-line intent from the title.
  return invoke<WorkItem>("add_work_item", { title, intent_id: intentId ?? null });
}

export async function setWorkStatus(
  id: string,
  status: "active" | "paused",
): Promise<WorkItem> {
  if (!IN_TAURI) {
    if (status !== "active" && status !== "paused") {
      throw new Error(`Unknown status: ${status}`);
    }
    const current = localWorkItems();
    if (!current.some((w) => w.id === id)) throw new Error(`Unknown work item: ${id}`);
    const items = current.map((w) =>
      w.id === id ? { ...w, status, updated_at: nowUnix() } : w,
    );
    saveLocalWorkItems(items);
    return items.find((w) => w.id === id)!;
  }
  return invoke<WorkItem>("set_work_status", { id, status });
}

export async function setWorkAutonomy(
  id: string,
  autonomy: WorkItem["autonomy"],
  justification?: string | null,
): Promise<WorkItem> {
  if (!IN_TAURI) {
    // Mirror the backend command: ceiling first, then justification on
    // raise, history recorded only when raising.
    const items = localWorkItems();
    const item = items.find((w) => w.id === id);
    if (!item) throw new Error(`Unknown work item: ${id}`);
    const requested = AUTONOMY_LEVELS.indexOf(autonomy);
    if (requested < 0) throw new Error(`Unknown autonomy level: ${autonomy}`);
    const list = localIntents();
    const intent = item.intent_id
      ? list.intents.find((i) => i.id === item.intent_id)
      : undefined;
    if (intent) {
      const allowed = AUTONOMY_LEVELS.indexOf(intent.autonomy);
      if (requested > allowed) {
        throw new Error(
          `Cannot raise this work item to "${autonomy}": its intent allows at most "${intent.autonomy}". Loosen the intent's autonomy first, or pick a lower level for this work item.`,
        );
      }
    }
    const currentRank = AUTONOMY_LEVELS.indexOf(item.autonomy);
    let updated: WorkItem = { ...item, autonomy, updated_at: nowUnix() };
    if (requested > currentRank) {
      const just = justification?.trim();
      if (!just) {
        throw new Error(
          `Raising autonomy from "${item.autonomy}" to "${autonomy}" requires a justification — why is more freedom needed?`,
        );
      }
      updated = {
        ...updated,
        autonomy_history: [
          ...(item.autonomy_history ?? []),
          { from: item.autonomy, to: autonomy, justification: just, at: nowUnix() },
        ],
      };
    }
    saveLocalWorkItems(items.map((w) => (w.id === id ? updated : w)));
    return updated;
  }
  return invoke<WorkItem>("set_work_autonomy", { id, autonomy, justification });
}


export interface MigrationPreviewItem {
  id: string;
  title: string;
  status: string;
  autonomy: string;
  proposed_task_name: string;
  conflicts: string[];
  notes: string[];
}

export interface MigrationPreview {
  items: MigrationPreviewItem[];
  total: number;
  ready: number;
  needs_decision: number;
}

/** Read-only preview of the work→task migration (decision 6): never
    migrates anything, never calls Loom. */
export const workMigrationPreview = () =>
  invokeCmd<MigrationPreview>("work_migration_preview");

export async function setWorkSession(
  id: string,
  sessionId: string | null,
): Promise<WorkItem> {
  if (!IN_TAURI) {
    const current = localWorkItems();
    if (!current.some((w) => w.id === id)) throw new Error(`Unknown work item: ${id}`);
    const items = current.map((w) =>
      w.id === id
        ? { ...w, session_id: sessionId?.trim() || null, updated_at: nowUnix() }
        : w,
    );
    saveLocalWorkItems(items);
    return items.find((w) => w.id === id)!;
  }
  return invoke<WorkItem>("set_work_session", { id, sessionId });
}

// ---- Intents (the primary object) ----

export async function getIntents(): Promise<IntentsList> {
  if (!IN_TAURI) return localIntents();
  return invoke<IntentsList>("get_intents");
}

export async function createIntent(args: {
  statement: string;
  why?: string | null;
  acceptance?: AcceptanceCriterion[];
  autonomy?: IntentAutonomy | null;
}): Promise<Intent> {
  if (!IN_TAURI) {
    return createLocalIntent(args.statement, args.why, args.acceptance ?? [], args.autonomy);
  }
  // `acceptance` is a required list on the backend: always send the key,
  // empty when there are no criteria yet.
  return invoke<Intent>("create_intent", {
    statement: args.statement,
    why: args.why ?? null,
    acceptance: normalizeCriteria(args.acceptance ?? []),
    autonomy: args.autonomy ?? null,
  });
}

export async function updateIntent(args: {
  id: string;
  statement?: string | null;
  why?: string | null;
  autonomy?: IntentAutonomy | null;
  status?: "active" | "done" | null;
  justification?: string | null;
}): Promise<Intent> {
  if (!IN_TAURI) {
    const list = localIntents();
    const idx = list.intents.findIndex((i) => i.id === args.id);
    if (idx < 0) throw new Error(`Unknown intent: ${args.id}`);
    const current = list.intents[idx];
    // Mirror the backend: a content change (statement, why, autonomy)
    // bumps the version and snapshots the previous version; a status
    // change alone does not. Null/undefined means "no change"; an empty
    // string clears the why.
    const newStatement =
      args.statement != null && args.statement.trim() !== ""
        ? args.statement.trim()
        : current.statement;
    const newWhy =
      args.why == null ? (current.why ?? null) : args.why.trim() === "" ? null : args.why.trim();
    const newAutonomy = args.autonomy ?? current.autonomy;
    const changed =
      newStatement !== current.statement ||
      newWhy !== (current.why ?? null) ||
      newAutonomy !== current.autonomy;
    const updated: Intent = { ...current };
    if (changed) {
      updated.history = [
        ...current.history,
        {
          version: current.version,
          statement: current.statement,
          why: current.why ?? null,
          acceptance: current.acceptance,
          updated_at: current.updated_at,
        },
      ];
      updated.version = current.version + 1;
      updated.updated_at = nowUnix();
    }
    // Autonomy history: record the change with justification when raising.
    if (args.autonomy != null && args.autonomy !== current.autonomy) {
      const oldRank = AUTONOMY_LEVELS.indexOf(current.autonomy);
      const newRank = AUTONOMY_LEVELS.indexOf(args.autonomy);
      if (newRank > oldRank) {
        const just = args.justification?.trim();
        if (!just) {
          throw new Error(
            `Raising autonomy from "${current.autonomy}" to "${args.autonomy}" requires a justification — why is more freedom needed?`,
          );
        }
      }
      updated.autonomy_history = [
        ...(current.autonomy_history ?? []),
        {
          from: current.autonomy,
          to: args.autonomy,
          justification: args.justification?.trim() || null,
          at: nowUnix(),
        },
      ];
    }
    updated.statement = newStatement;
    updated.why = newWhy;
    updated.autonomy = newAutonomy;
    if (args.status != null) {
      updated.status = args.status;
      updated.updated_at = nowUnix();
    }
    list.intents[idx] = updated;
    saveLocalIntents(list);
    return updated;
  }
  return invoke<Intent>("update_intent", {
    id: args.id,
    statement: args.statement ?? null,
    why: args.why ?? null,
    autonomy: args.autonomy ?? null,
    status: args.status ?? null,
    justification: args.justification ?? null,
  });
}

export async function setIntentAcceptance(args: {
  id: string;
  criteria: AcceptanceCriterion[];
}): Promise<Intent> {
  if (!IN_TAURI) {
    const list = localIntents();
    const idx = list.intents.findIndex((i) => i.id === args.id);
    if (idx < 0) throw new Error(`Unknown intent: ${args.id}`);
    // Toggling acceptance never bumps the version and keeps no history.
    const updated: Intent = {
      ...list.intents[idx],
      acceptance: normalizeCriteria(args.criteria),
      updated_at: nowUnix(),
    };
    list.intents[idx] = updated;
    saveLocalIntents(list);
    return updated;
  }
  return invoke<Intent>("set_intent_acceptance", {
    id: args.id,
    criteria: normalizeCriteria(args.criteria),
  });
}

export async function setActiveIntent(id: string): Promise<Intent> {
  if (!IN_TAURI) {
    const list = localIntents();
    const intent = list.intents.find((i) => i.id === id);
    if (!intent) throw new Error(`Unknown intent: ${id}`);
    list.active_intent_id = id;
    saveLocalIntents(list);
    return intent;
  }
  return invoke<Intent>("set_active_intent", { id });
}

export async function deleteIntent(id: string): Promise<boolean> {
  if (!IN_TAURI) {
    const count = localWorkItems().filter((w) => w.intent_id === id).length;
    if (count > 0) {
      throw new Error(
        `Cannot delete intent ${id}: ${count} work item(s) still reference it. Reassign or delete that work first.`,
      );
    }
    const list = localIntents();
    const idx = list.intents.findIndex((i) => i.id === id);
    if (idx < 0) throw new Error(`Unknown intent: ${id}`);
    list.intents.splice(idx, 1);
    if (list.active_intent_id === id) list.active_intent_id = null;
    saveLocalIntents(list);
    return true;
  }
  return invoke<boolean>("delete_intent", { id });
}

// The Loom server does not expose step-by-step execution yet, so
// collaboration stays empty. Attention is real: the backend returns the
// experiment decisions already waiting locally. No seed data.

export async function getAttention(): Promise<AttentionItem[]> {
  if (!IN_TAURI) return [];
  return invoke<AttentionItem[]>("get_attention");
}

// Commands below run only inside the Tauri app. In a plain browser
// (vite dev) they throw a clear error instead of a raw invoke failure.
async function invokeCmd<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!IN_TAURI) {
    throw new Error(
      `"${command}" needs the Tauri app — it is not available in the browser preview.`,
    );
  }
  return invoke<T>(command, args);
}

export async function getLoomStatus(): Promise<LoomStatus> {
  if (!IN_TAURI) {
    try {
      // Use the same component health endpoint and timeout as Rust.
      // The unversioned /health route is a static liveness response.
      const value = await loomRequest("/v1/health", undefined, 30000);
      const status = value?.status;
      const components = value?.components;
      const failures = components && typeof components === "object"
        ? Object.entries(components)
          .filter(([, component]) => (component as { status?: string })?.status !== "healthy")
          .map(([name, component]) => {
            const health = component as { status?: string; error?: string } | null;
            return `${name}: ${health?.error || health?.status || "unknown"}`;
          }).join(", ")
        : "";
      const detail = status === "healthy"
        ? "Loom HTTP service is healthy."
        : status === "degraded"
          ? `Loom is degraded (${failures || "see /v1/health"}).`
          : typeof status === "string"
            ? `Loom reports ${status}: ${failures || "see /v1/health"}.`
            : "Server reachable; Loom health status was not reported.";
      return {
        online: typeof status !== "string" || status === "healthy" || status === "degraded",
        url: "/api/loom",
        detail,
      };
    } catch (error) {
      return { online: false, url: "/api/loom", detail: String(error) };
    }
  }
  return invoke<LoomStatus>("get_loom_status");
}

async function loomRequest(path: string, body?: object, timeoutMs?: number): Promise<any> {
  const response = await fetch(`/api/loom${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs ?? (body ? 180000 : 5000)),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || value.error || `Loom returned HTTP ${response.status}`);
  return value;
}

// Throws when the Loom server cannot be reached or answers without
// usable text. The caller shows the error; nothing invents a reply.
export async function askLoom(
  message: string,
  sessionId?: string,
  agentId?: string,
  context?: Record<string, string>,
): Promise<ChatReply> {
  if (IN_TAURI) {
    return invoke<ChatReply>("ask_loom", { message, sessionId, agentId, context });
  }
  if (!message.trim()) throw new Error("Enter a message first.");
  const body: Record<string, unknown> = { query: message };
  if (sessionId?.trim()) body.sessionId = sessionId;
  if (agentId?.trim()) body.agentId = agentId;
  if (context && Object.keys(context).length > 0) body.context = context;
  const value = await loomRequest("/v1/weave", body as object);
  const text = [value.text, value.response, value.content, value.reply, value.message]
    .find(value => typeof value === "string" && value.trim());
  if (!text) throw new Error("Loom returned an empty response. Check its agent configuration.");
  const session = value.session_id ?? value.sessionId;
  return {
    text,
    source: "live",
    card: null,
    session_id: typeof session === "string" && session.trim() ? session : null,
  };
}

// ---- Sessions + agents (real Loom server; fail honestly when offline) ----

export async function listSessions(): Promise<Session[]> {
  return invokeCmd<Session[]>("list_sessions");
}

export async function createSession(
  name?: string,
  agentId?: string,
): Promise<Session> {
  return invokeCmd<Session>("create_session", { name, agentId });
}

export async function listAgents(): Promise<Agent[]> {
  return invokeCmd<Agent[]>("list_agents");
}

export async function getSessionHistory(sessionId: string): Promise<HistoryMessage[]> {
  return invokeCmd<HistoryMessage[]>("get_session_history", { sessionId });
}

// ---- Workspace explorer (local filesystem; works without the server) ----

export async function getWorkspace(): Promise<WorkspaceInfo | null> {
  if (!IN_TAURI) return null;
  return invokeCmd<WorkspaceInfo>("get_workspace");
}

export async function openWorkspace(path: string): Promise<WorkspaceInfo> {
  return invokeCmd<WorkspaceInfo>("open_workspace", { path });
}

export async function listWorkspace(): Promise<DirEntry[]> {
  return invokeCmd<DirEntry[]>("list_workspace");
}

export async function listDirectory(path: string): Promise<DirEntry[]> {
  return invokeCmd<DirEntry[]>("list_directory", { path });
}

export async function createWorkspaceFile(parent: string, name: string): Promise<DirEntry> {
  return invokeCmd<DirEntry>("create_workspace_file", { parent, name });
}

export async function createWorkspaceDirectory(parent: string, name: string): Promise<DirEntry> {
  return invokeCmd<DirEntry>("create_workspace_directory", { parent, name });
}

export async function readFile(path: string): Promise<string> {
  return invokeCmd<string>("read_file", { path });
}

export async function writeFile(path: string, content: string, original: string): Promise<void> {
  return invokeCmd<void>("write_file", { path, content, original });
}

// ---- Experiments (local definitions; arms run through real Loom calls) ----

export async function getExperiments(): Promise<Experiment[]> {
  return invokeCmd<Experiment[]>("get_experiments");
}

export async function addExperiment(
  title: string,
  question: string,
  hypothesis: string,
): Promise<Experiment> {
  return invokeCmd<Experiment>("add_experiment", { title, question, hypothesis });
}

export async function addExperimentArm(
  id: string,
  label: string,
  config: string,
): Promise<Experiment> {
  return invokeCmd<Experiment>("add_experiment_arm", { id, label, config });
}

export async function setExperimentArmStatus(
  id: string,
  armId: string,
  status: string,
): Promise<Experiment> {
  return invokeCmd<Experiment>("set_experiment_arm_status", { id, armId, status });
}

export async function setExperimentArmResult(
  id: string,
  armId: string,
  result: string,
): Promise<Experiment> {
  return invokeCmd<Experiment>("set_experiment_arm_result", { id, armId, result });
}

export async function chooseExperimentArm(
  id: string,
  armId: string,
): Promise<Experiment> {
  return invokeCmd<Experiment>("choose_experiment_arm", { id, armId });
}

export async function clearExperimentDecision(id: string): Promise<Experiment> {
  return invokeCmd<Experiment>("clear_experiment_decision", { id });
}

// ---- Work detail: success criteria + attachments (local, via work store) ----

export async function setWorkSuccessCriteria(
  id: string,
  criteria: string[],
): Promise<WorkItem> {
  return invokeCmd<WorkItem>("set_work_success_criteria", { id, criteria });
}

export async function setWorkArtifacts(
  id: string,
  artifactIds: string[],
): Promise<WorkItem> {
  return invokeCmd<WorkItem>("set_work_artifacts", { id, artifactIds });
}

// ---- Workflows + artifacts (real Loom server) ----

export async function listWorkflows(): Promise<Workflow[]> {
  return invokeCmd<Workflow[]>("list_workflows");
}

export async function executeWorkflow(
  workflowRef: string,
): Promise<ExecuteWorkflowResponse> {
  return invokeCmd<ExecuteWorkflowResponse>("execute_workflow", { workflowRef });
}

export async function getWorkflowExecution(
  executionId: string,
): Promise<WorkflowExecution> {
  return invokeCmd<WorkflowExecution>("get_workflow_execution", { executionId });
}

export async function listWorkflowExecutions(): Promise<WorkflowExecution[]> {
  return invokeCmd<WorkflowExecution[]>("list_workflow_executions");
}

export async function listArtifacts(sessionId?: string): Promise<Artifact[]> {
  return sessionId
    ? invokeCmd<Artifact[]>("list_artifacts", { sessionId })
    : invokeCmd<Artifact[]>("list_artifacts");
}

// ---- Session details (real Loom server) ----

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return invokeCmd<SessionDetail>("get_session", { sessionId });
}

// ---- Tools (real Loom server) ----

export async function listTools(): Promise<ToolDefinition[]> {
  return invokeCmd<ToolDefinition[]>("list_tools");
}

// ---- Agent details (real Loom server) ----

export async function getAgent(agentId: string): Promise<Agent> {
  return invokeCmd<Agent>("get_agent", { agentId });
}

// ---- Models + providers (real Loom server) ----

export async function listModels(): Promise<ModelInfo[]> {
  return invokeCmd<ModelInfo[]>("list_models");
}

export async function listProviders(): Promise<ProviderEntry[]> {
  return invokeCmd<ProviderEntry[]>("list_providers");
}


/// An execution trace (GET /v1/traces/{trace_id}). Mirrors the Rust
/// Trace / TraceSpan structs in src-tauri/src/lib.rs.
export interface TraceSpan {
  id: string;
  parent_id: string;
  name: string;
  start_time_us: number;
  end_time_us: number;
  duration_us: number;
  status: string;
  attributes: Record<string, string>;
}

export interface Trace {
  id: string;
  session_id: string;
  root_span?: TraceSpan | null;
  spans: TraceSpan[];
  total_duration_ms: number;
}

// ---- Artifact detail and statistics (real Loom server) ----

export async function getArtifact(artifactId: string): Promise<Artifact> {
  return invokeCmd<Artifact>("get_artifact", { artifactId });
}

export async function getArtifactStats(): Promise<ArtifactStats> {
  return invokeCmd<ArtifactStats>("get_artifact_stats");
}

// ---- Trace, model switch, artifact content + search (real Loom server) ----
// These backend commands existed in src-tauri/src/lib.rs but had no
// frontend wrapper, so no view could call them. They fail honestly
// outside the Tauri app, like every other invokeCmd wrapper.

export async function getTrace(traceId: string): Promise<Trace> {
  return invokeCmd<Trace>("get_trace", { traceId });
}

export async function switchModel(
  sessionId: string,
  agentId?: string,
  provider?: string,
  model?: string,
): Promise<unknown> {
  return invokeCmd<unknown>("switch_model", { sessionId, agentId, provider, model });
}

export async function getArtifactContent(
  artifactId: string,
  encoding?: string,
): Promise<string> {
  return invokeCmd<string>("get_artifact_content", { artifactId, encoding });
}

export async function searchArtifacts(query: string): Promise<Artifact[]> {
  return invokeCmd<Artifact[]>("search_artifacts", { query });
}

// ---- Server info (real Loom server) ----

export async function getServerConfig(): Promise<ServerConfig> {
  return invokeCmd<ServerConfig>("get_server_config");
}

export async function getStorageStatus(): Promise<StorageStatus> {
  return invokeCmd<StorageStatus>("get_storage_status");
}

// Markdown knowledge is desktop-only; never substitute a browser JSON store.
export interface KnowledgeMeta {
  id: string; kind: string; title: string; created: number; modified: number;
  author: string; source: string; status: string; version: number;
}
export interface KnowledgeNote { meta: KnowledgeMeta; body: string; path: string; original: string }
export interface KnowledgeEdge { from: string; to: string; kind: string }
export interface KnowledgeAudit { at: number; action: string; object: string; actor: string; detail: string }
export interface KnowledgeListing {
  notes: KnowledgeNote[]; archived: KnowledgeNote[]; edges: KnowledgeEdge[]; activity: KnowledgeAudit[];
  pending: number; revision: string; root: string; kinds: string[]; folders: string[]; relations: string[];
}
export interface KnowledgeDetail { note: KnowledgeNote; edges: KnowledgeEdge[]; versions: KnowledgeNote[]; backlinks: KnowledgeEdge[]; audit: KnowledgeAudit[]; revision: string }
function vaultInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!IN_TAURI) return Promise.reject(new Error("Open Loom in Tauri to use your markdown vault."));
  return invoke<T>(command, args);
}
export const listKnowledge = (query = "") => vaultInvoke<KnowledgeListing>("knowledge_list", { query });
export const readKnowledge = (id: string) => vaultInvoke<KnowledgeDetail>("knowledge_read", { id });
export const createKnowledge = (title: string, body: string, kind: string, folder: string, revision: string) =>
  vaultInvoke<string>("knowledge_create", { title, body, kind, folder, revision, actor: "human" });
export const saveKnowledge = (note: KnowledgeNote, revision: string) => vaultInvoke<void>("knowledge_save", { note, revision });
export const relateKnowledge = (edge: KnowledgeEdge, unlink: boolean, revision: string) => vaultInvoke<void>("knowledge_relate", { edge, unlink, revision });
export const reviewKnowledge = (id: string, approved: boolean, reason: string, original: string, revision: string) =>
  vaultInvoke<void>("knowledge_review", { id, approved, reason, original, revision });
export const archiveKnowledge = (id: string, original: string, revision: string) =>
  vaultInvoke<void>("knowledge_archive", { id, original, revision });
export const restoreKnowledge = (id: string, original: string, revision: string) =>
  vaultInvoke<void>("knowledge_restore", { id, original, revision });
export const exportKnowledgeCanvas = () => vaultInvoke<string>("knowledge_export_canvas");
export const syncKnowledge = () => vaultInvoke<number>("knowledge_sync_from_loom");
export const knowledgeSignature = () => vaultInvoke<VaultSignature>("knowledge_signature");
export const saveCanvasLayout = (positions: { id: string; x: number; y: number }[]) =>
  vaultInvoke<void>("knowledge_canvas_layout_save", { positions });
export const loadCanvasLayout = () =>
  vaultInvoke<{ id: string; x: number; y: number }[]>("knowledge_canvas_layout_load");

// ---- Streaming chat (POST /v1/weave:stream over the backend's SSE bridge) ----

export async function askLoomStream(
  requestId: string,
  message: string,
  sessionId?: string,
  agentId?: string,
  context?: Record<string, string>,
): Promise<void> {
  return invokeCmd<void>("ask_loom_stream", { requestId, message, sessionId, agentId, context });
}

export async function cancelLoomStream(requestId: string): Promise<void> {
  return invokeCmd<void>("cancel_loom_stream", { requestId });
}

export async function answerClarification(
  sessionId: string,
  questionId: string,
  answer: string,
): Promise<string> {
  return invokeCmd<string>("answer_clarification", { sessionId, questionId, answer });
}

// ---- MCP server management ----

export const listMcpServers = () => invokeCmd<McpServer[]>("mcp_servers_list");
export const getMcpServer = (serverName: string) =>
  invokeCmd<McpServer>("mcp_server_get", { serverName });
export const addMcpServer = (
  name: string, transport: string,
  command?: string, args?: string[], url?: string, enabled?: boolean,
) => invokeCmd<McpServer>("mcp_server_add", { name, transport, command, args, url, enabled });
export const updateMcpServer = (
  serverName: string,
  transport?: string, command?: string, args?: string[], url?: string, enabled?: boolean,
) => invokeCmd<McpServer>("mcp_server_update", { serverName, transport, command, args, url, enabled });
export const deleteMcpServer = (serverName: string) =>
  invokeCmd<string>("mcp_server_delete", { serverName });
export const restartMcpServer = (serverName: string) =>
  invokeCmd<McpServer>("mcp_server_restart", { serverName });
export const healthCheckMcpServers = () =>
  invokeCmd<McpServer[]>("mcp_servers_health_check");
export interface McpTestResult {
  success: boolean;
  message: string;
  tool_count: number;
}

export const testMcpServer = (
  name: string, transport: string,
  command?: string, args?: string[], url?: string,
) => invokeCmd<McpTestResult>("mcp_server_test", { name, transport, command, args, url });
export const listMcpServerTools = (serverName: string) =>
  invokeCmd<unknown[]>("mcp_server_tools", { serverName });

// ---- Agent lifecycle ----

export const createAgent = (config: Record<string, unknown>) =>
  invokeCmd<unknown>("agent_create", { config });
export const startAgent = (agentId: string) => invokeCmd<unknown>("agent_start", { agentId });
export const stopAgent = (agentId: string) => invokeCmd<unknown>("agent_stop", { agentId });
export const reloadAgent = (agentId: string) => invokeCmd<unknown>("agent_reload", { agentId });
export const deleteAgent = (agentId: string) => invokeCmd<unknown>("agent_delete", { agentId });
export const listAgentPresets = () => invokeCmd<unknown[]>("agent_presets_list");
export const listWorkflowTemplates = () => invokeCmd<unknown[]>("workflow_templates_list");

// ---- Patterns ----

export const listPatterns = () => invokeCmd<unknown[]>("patterns_list");
export const getPattern = (name: string) => invokeCmd<unknown>("pattern_get", { name });
export const createPattern = (body: Record<string, unknown>) =>
  invokeCmd<unknown>("pattern_create", { body });
export const loadPatterns = (source: string) => invokeCmd<unknown>("patterns_load", { source });

// ---- Embedded MCP apps ----

export const listApps = () => invokeCmd<unknown[]>("apps_list");

// ---- Session completeness ----

export const deleteSession = (sessionId: string) =>
  invokeCmd<string>("session_delete", { sessionId });
export const resumeSession = (sessionId: string) =>
  invokeCmd<unknown>("session_resume", { sessionId });
export const resolveSessionGap = (sessionId: string) =>
  invokeCmd<unknown>("session_resolve_gap", { sessionId });

// ---- Workflow streaming, session subscribe, provider A/B (SSE bridges) ----

export interface WorkflowProgressEvent {
  /** Protojson (grpc-gateway NDJSON) camelCase; int64 arrives as a string. */
  executionId?: string;
  patternType?: string;
  currentAgentId?: string;
  progress?: number;
  message?: string;
  timestamp?: string | number;
  partialResults?: unknown[];
}
export interface AbTestEvent {
  /** ABTestEvent is flat; the gateway NDJSON wire is protojson camelCase
      and int64 latency_ms arrives as a JSON string. */
  providerName?: string;
  contentChunk?: string;
  finished?: boolean;
  score?: number;
  latencyMs?: string | number;
  costUsd?: number;
  winner?: string;
  abTestId?: string;
}
export interface StreamEnvelope<T> {
  requestId: string;
  kind: "progress" | "done" | "error" | "cancelled";
  event?: T;
  error?: string | null;
}

export const executeWorkflowStream = (requestId: string, workflowRef: string) =>
  invokeCmd<void>("execute_workflow_stream", { requestId, workflowRef });
export const sessionSubscribe = (requestId: string, sessionId: string) =>
  invokeCmd<void>("session_subscribe", { requestId, sessionId });
export const providerAbtest = (
  requestId: string, prompt: string, providerNames?: string[], mode?: string,
) => invokeCmd<void>("provider_abtest", { requestId, prompt, providerNames, mode });

// ---- Workflow scheduling ----

export const listWorkflowSchedules = () => invokeCmd<unknown[]>("workflow_schedules_list");
export const getWorkflowSchedule = (scheduleId: string) =>
  invokeCmd<unknown>("workflow_schedule_get", { scheduleId });
export const createWorkflowSchedule = (
  workflowName: string, cron: string, timezone?: string, enabled?: boolean,
) => invokeCmd<unknown>("workflow_schedule_create", { workflowName, cron, timezone, enabled });
export const updateWorkflowSchedule = (
  scheduleId: string, cron?: string, timezone?: string, enabled?: boolean,
) => invokeCmd<unknown>("workflow_schedule_update", { scheduleId, cron, timezone, enabled });
export const deleteWorkflowSchedule = (scheduleId: string) =>
  invokeCmd<string>("workflow_schedule_delete", { scheduleId });
export const triggerWorkflowSchedule = (scheduleId: string) =>
  invokeCmd<unknown>("workflow_schedule_trigger", { scheduleId });
export const workflowScheduleHistory = (scheduleId: string) =>
  invokeCmd<unknown[]>("workflow_schedule_history", { scheduleId });
export const pauseWorkflowSchedule = (scheduleId: string) =>
  invokeCmd<unknown>("workflow_schedule_pause", { scheduleId });
export const resumeWorkflowSchedule = (scheduleId: string) =>
  invokeCmd<unknown>("workflow_schedule_resume", { scheduleId });
export const cancelScheduledExecution = (executionId: string) =>
  invokeCmd<unknown>("workflow_schedule_cancel_execution", { executionId });
export const patternUpdatesStream = (requestId: string) =>
  invokeCmd<void>("pattern_updates_stream", { requestId });
export const taskUpdatesStream = (requestId: string, boardId: string) =>
  invokeCmd<void>("task_updates_stream", { requestId, boardId });

// ---- Loom tasks and boards (100% HTTP — no transport decision) ----

export interface LoomTask {
  id?: string;
  title?: string;
  description?: string;
  objective?: string;
  approach?: string;
  acceptance_criteria?: string;
  status?: string | number;
  priority?: string | number;
  board_id?: string;
  assignee_agent_id?: string;
  parent_id?: string;
}

export const listLoomBoards = () => invokeCmd<unknown[]>("task_boards_list");
export const getLoomBoard = (boardId: string) => invokeCmd<unknown>("task_board_get", { boardId });
export const createLoomBoard = (board: Record<string, unknown>) =>
  invokeCmd<unknown>("task_board_create", { board });
export const listLoomTasks = (boardId?: string, status?: string, query?: string) =>
  invokeCmd<unknown[]>("loom_tasks_list", { boardId, status, query });
export const getLoomTask = (taskId: string) => invokeCmd<unknown>("loom_task_get", { taskId });
export const createLoomTask = (task: Record<string, unknown>) =>
  invokeCmd<unknown>("loom_task_create", { task });
export const updateLoomTask = (task: Record<string, unknown>) =>
  invokeCmd<unknown>("loom_task_update", { task });
export const deleteLoomTask = (taskId: string) =>
  invokeCmd<string>("loom_task_delete", { taskId });
export const claimLoomTask = (taskId: string, agentId?: string, sessionId?: string) =>
  invokeCmd<unknown>("loom_task_claim", { taskId, agentId, sessionId });
export const releaseLoomTask = (taskId: string) =>
  invokeCmd<unknown>("loom_task_release", { taskId });
export const closeLoomTask = (taskId: string) =>
  invokeCmd<unknown>("loom_task_close", { taskId });
export const transitionLoomTask = (taskId: string, newStatus: string, reason?: string) =>
  invokeCmd<unknown>("loom_task_transition", { taskId, newStatus, reason });
export const addLoomTaskDependency = (fromTaskId: string, toTaskId: string) =>
  invokeCmd<unknown>("loom_task_add_dependency", { fromTaskId, toTaskId });
export const removeLoomTaskDependency = (fromTaskId: string, toTaskId: string) =>
  invokeCmd<string>("loom_task_remove_dependency", { fromTaskId, toTaskId });
export const boardReadyTasks = (boardId: string) =>
  invokeCmd<unknown[]>("task_board_ready", { boardId });
export const boardBlockedTasks = (boardId: string) =>
  invokeCmd<unknown[]>("task_board_blocked", { boardId });
export const decomposeLoomTask = (goal: string, context?: string, boardId?: string) =>
  invokeCmd<unknown>("loom_task_decompose", { goal, context, boardId });
export const loomTaskContext = (agentId: string) =>
  invokeCmd<unknown>("loom_task_context", { agentId });

// ---- Skills (100% HTTP) ----

export const addSkill = (inline: Record<string, unknown>) =>
  invokeCmd<unknown>("skills_add", { inline });
export const classifySkill = (skillName: string) =>
  invokeCmd<unknown>("skills_classify", { skillName });
export const bulkImportSkills = (requestId: string, srcDir: string, outDir?: string) =>
  invokeCmd<void>("skills_bulk_import", { requestId, srcDir, outDir });

// ---- MCP apps CRUD ----

export const getApp = (name: string) => invokeCmd<unknown>("apps_get", { name });
export const createApp = (body: Record<string, unknown>) =>
  invokeCmd<unknown>("apps_create", { body });
export const updateApp = (name: string, body: Record<string, unknown>) =>
  invokeCmd<unknown>("apps_update", { name, body });
export const deleteApp = (name: string) => invokeCmd<string>("apps_delete", { name });
export const listComponentTypes = () => invokeCmd<unknown[]>("apps_component_types");

// ---- Tools: register + permission ----

export const registerTool = (tool: Record<string, unknown>) =>
  invokeCmd<unknown>("tools_register", { tool });
export const requestToolPermissionCmd = (
  sessionId: string, toolName: string,
  argsJson?: string, description?: string, riskLevel?: string,
) => invokeCmd<unknown>("tool_permission_request", { sessionId, toolName, argsJson, description, riskLevel });

// ---- Server administration ----

export const getTlsStatus = () => invokeCmd<unknown>("tls_status");
export const renewCertificate = () => invokeCmd<unknown>("tls_renew");
export const runMigration = () => invokeCmd<unknown>("run_migration");
