import { loomState } from "./loom-state";
import { installKnowledge } from "./knowledge";
import { getAppearance, setAppearance } from "./theme";
import { installSpatialWorkbench, notifySpatialVaultChanged, notifySpatialState } from "./spatial";
import "./style.css";
import {
  addExperiment,
  addExperimentArm,
  addWorkItem,
  askLoom,
  chooseExperimentArm,
  clearExperimentDecision,
  createIntent,
  createSession,
  createWorkspaceDirectory,
  createWorkspaceFile,
  deleteIntent,
  executeWorkflow,
  getAgent,
  getArtifactContent,
  getArtifactStats,
  getAttention,
  getExperiments,
  getIntents,
  getLoomStatus,
  getServerConfig,
  getSession,
  getSessionHistory,
  getStorageStatus,
  getWorkflowExecution,
  getWorkItems,
  getWorkspace,
  openWorkspace,
  writeFile,
  isTauri,
  listAgents,
  listArtifacts,
  listDirectory,
  listModels,
  listProviders,
  listSessions,
  listTools,
  listWorkflowExecutions,
  listWorkflows,
  listWorkspace,
  readFile,
  searchArtifacts,
  setActiveIntent,
  setExperimentArmResult,
  setExperimentArmStatus,
  setIntentAcceptance,
  setWorkArtifacts,
  setWorkAutonomy,
  setWorkSession,
  setWorkStatus,
  setWorkSuccessCriteria,
  updateIntent,
  type AcceptanceCriterion,
  type Agent,
  type Artifact,
  type ArtifactStats,
  type AttentionItem,
  type ChatReply,
  type DirEntry,
  type Experiment,
  type ExperimentArm,
  type Intent,
  type IntentAutonomy,
  type ModelInfo,
  type ProviderEntry,
  type Session,
  type SessionDetail,
  type ServerConfig,
  type StorageStatus,
  type ToolDefinition,
  type Workflow,
  type WorkflowExecution,
  type WorkflowResult,
  type WorkItem,
  type WorkspaceInfo,
  type EvidenceKind,
  evidenceKindLabel,
  type AutonomyChange,
  type LoomStreamEvent,
  type McpServer,
  type StreamEnvelope,
  type WorkflowProgressEvent,
  type AbTestEvent,
  askLoomStream,
  cancelLoomStream,
  answerClarification,
  executeWorkflowStream,
  sessionSubscribe,
  providerAbtest,
  listWorkflowSchedules,
  createWorkflowSchedule,
  updateWorkflowSchedule,
  deleteWorkflowSchedule,
  triggerWorkflowSchedule,
  workflowScheduleHistory,
  resolveSessionGap,
  listMcpServers,
  addMcpServer,
  deleteMcpServer,
  restartMcpServer,
  healthCheckMcpServers,
  testMcpServer,
  listMcpServerTools,
  createAgent,
  startAgent,
  stopAgent,
  reloadAgent,
  deleteAgent,
  listAgentPresets,
  listApps,
  deleteSession,
  resumeSession,
  getTrace,
} from "./api";
import type { SphereState } from "./sphere";
import { installAppMenu, textEditingActions } from "./app-menu";
import { listen } from "@tauri-apps/api/event";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Mode = "code" | "experiment" | "work" | "agents" | "evidence" | "artifacts" | "spatial" | "knowledge";

type NoteKind = "design" | "scratch";
type RightTab = "context" | "conversation";

const LAYERS: { id: string; label: string; desc: string }[] = [
  {
    id: "light",
    label: "Light beam",
    desc: "The soft diagonal light across the scene.",
  },
  {
    id: "water",
    label: "Water reflection",
    desc: "The reflective band along the bottom, Experiment overview only.",
  },
  {
    id: "glass",
    label: "Glass panels",
    desc: "Translucent panels with blur. Off: flat solid panels.",
  },
];

const CAPTIONS: Record<SphereState, string> = {
  error: "Needs attention — check the connection or local activity.",
  exploring: "Exploring local knowledge.",
  idle: "At rest — nothing is running.",
  listening: "Listening — Loom is with you.",
  processing: "Thinking — preparing a reply.",
  executing: "An agent is working on your work.",
  attention: "Needs you — a decision is waiting.",
  completed: "Done — back at rest.",
};

/** Compatibility access to earlier user notes, shown only when saved text exists. */
const NOTE_DOCS: { id: string; title: string; detail: string; kind: NoteKind }[] = [
  { id: "doc-design", title: "Previous design note", detail: "Saved locally", kind: "design" },
  { id: "doc-scratch", title: "Previous scratch note", detail: "Saved locally", kind: "scratch" },
];

let workItems: WorkItem[] = [];
let selectedWorkId: string | null = null;
/** Intents (the primary object): one intent owns many pieces of work. */
let intents: Intent[] = [];
let activeIntentId: string | null = null;
/** The intent editor open in the pinned header; null when closed. */
let intentEditor: { mode: "create" } | { mode: "edit"; id: string } | null = null;
/** An intent created by a submit whose activation failed: a retry reuses
    this id (same statement only) instead of creating a duplicate. */
let pendingCreatedIntent: { id: string; statement: string } | null = null;
/** Last intents-load failure, kept so the header can say so instead of
    showing the empty state. Never clears the previously loaded intents. */
let intentsLoadError: string | null = null;
let mode: Mode = "spatial";
let sphereState: SphereState = "idle";
let knowledge: ReturnType<typeof installKnowledge> | null = null;
let pendingKnowledge = 0;
let knowledgeFailed = false;
let chatInFlight = 0;
/** The request id of the streamed weave in flight, when streaming. */
let activeStreamId: string | null = null;
/** The session the in-flight stream is (or was auto-created into) running
    against — used to deliver clarification answers mid-turn. */
let activeStreamSessionId: string | null = null;
let currentNote: NoteKind | null = null;
let artifactTab: "artifacts" | "documents" = "artifacts";
let loomReachable = false;
let loomVerified = false;
/** False until the first status probe resolves; the UI shows a neutral
    "Checking Loom…" state instead of flashing "offline" meanwhile. */
let loomStatusKnown = false;
let attentionItems: AttentionItem[] = [];
let sessions: Session[] = [];
let selectedSessionId: string | null = null;
let sessionDetail: SessionDetail | null = null;
let agents: Agent[] = [];
let selectedAgentId: string | null = null;
let selectedAgentDetail: Agent | null = null;
let tools: ToolDefinition[] = [];
let models: ModelInfo[] = [];
let providers: ProviderEntry[] = [];
let artifactStats: ArtifactStats | null = null;
let serverConfig: ServerConfig | null = null;
let storageStatus: StorageStatus | null = null;
let experiments: Experiment[] = [];
let selectedExperimentId: string | null = null;
let workflows: Workflow[] = [];
let executions: WorkflowExecution[] = [];
/** Server list caps: when a list returns exactly this many rows, the
    server may hold more. The UI says so instead of pretending the list
    is complete. */
const SESSIONS_LIMIT = 500;
const ARTIFACTS_LIMIT = 200;
const EXECUTIONS_LIMIT = 500;
/** Executions are shown 10 at a time, with a Show more button. */
const EXECUTIONS_PAGE = 10;
let executionsShown = EXECUTIONS_PAGE;

/** Tell the Unity bench the vault changed, so its portal counts update
    live without a manual refresh (audit A5). Selection alone does not
    change the counts, so it needs no push. */
function refreshSpatialVault(): void {
  notifySpatialVaultChanged(workItems.length, experiments.length);
}
let artifacts: Artifact[] = [];
/** Artifacts for the selected work ("what this work produced"): scoped to
    the work's session when it has one, otherwise the global list. */
let workArtifacts: Artifact[] = [];
let runningWorkflow: string | null = null;
/** The streamed workflow run in flight, and its last progress snapshot
    (live progress instead of one blocking wait, §14.2). */
let workflowStreamActive: string | null = null;
let workflowStreamState: { progress: number; message: string; executionId: string | null } | null = null;
/** The active session subscription (GET /v1/sessions/{id}:subscribe). */
let sessionSubId: string | null = null;
/** Workflow schedules (HTTP-bound; no transport decision needed). */
let workflowSchedules: unknown[] = [];
let schedulesLoadError: string | null = null;
/** The provider A/B run in flight, keyed per provider. */
let abtestState: {
  requestId: string;
  per: Map<string, { text: string; finished: boolean; score?: number; latencyMs?: number; costUsd?: number }>;
  winner?: string;
  error?: string;
} | null = null;
/** Mutation errors shown next to the section they belong to, never only
    in a conversation that may be closed. */
let workArtifactsError: string | null = null;
/** Artifact contents loaded on demand in the Artifacts view, keyed by
    artifact id. The backend decodes base64 (see get_artifact_content);
    the frontend only displays the returned text. */
const artifactContents = new Map<string, string>();
const artifactContentLoading = new Set<string>();
let workflowError: string | null = null;
/** Work that started a workflow run or experiment arm in this app session.
    The Loom server does not attribute executions or experiments to work,
    so this is the only honest scoping available. It is intentionally
    in-memory: nothing is implied to survive a restart. */
const executionWorkIds = new Map<string, string>();
const experimentWorkIds = new Map<string, string>();
/** When true, stop polling the current workflow run and clear the
    running state. The server-side execution continues (there is no cancel
    endpoint), but the UI stops tracking it — honest about the limit
    instead of pretending control that doesn't exist (P2 Human Agency). */
let cancelWorkflow = false;
/** Run token: each runWorkflow call takes the next number, and only the
    run holding the current token may touch running state on completion.
    A dismissed run's late completion must not clear a newer run. */
let runSeq = 0;
let currentRunSeq = 0;
/** Workflow names for executions started in this session (the server does
    not report a workflow name on executions). */
const executionWorkflowNames = new Map<string, string>();
let lastFocus: HTMLElement | null = null;
const layerOn: Record<string, boolean> = {
  light: true,
  water: true,
  glass: true,
};

const $ = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;

// ---------------------------------------------------------------------------
// Local activity supplements the single Loom connection indicator.
// ---------------------------------------------------------------------------

function setSphereState(state: SphereState) {
  sphereState = state;
  renderStatusPill();
  if (state === "error") window.setTimeout(() => { if (sphereState === "error") setSphereState("idle"); }, 6000);
}

// ---------------------------------------------------------------------------
// Time + labels (truthful, never "Now ago")
// ---------------------------------------------------------------------------

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Relative time from a unix-seconds timestamp: "Now" / "5m ago" / "2h ago". */
function relativeTime(unixSeconds: number): string {
  if (!unixSeconds || unixSeconds <= 0) return "Unknown";
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "Now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Short date/time for a unix-seconds timestamp ("Nov 12, 10:24 PM"). */
function formatUnix(unixSeconds: number): string {
  if (!unixSeconds || unixSeconds <= 0) return "";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format bytes into a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Short time token for list rows: "Now" / "2h ago". */
function timeLabel(item: WorkItem): string {
  return relativeTime(item.updated_at);
}

/** Metadata line: status + when it was updated. Autonomy is shown
    once, in its labeled control — never here. */
function metaLabel(item: WorkItem): string {
  const when = relativeTime(item.updated_at);
  return `${capitalize(item.status)} · ${when === "Now" ? "Updated now" : when === "Unknown" ? "Updated at an unknown time" : `Updated ${when}`}`;
}

// ---------------------------------------------------------------------------
// Focus restoration (re-renders rebuild the DOM from scratch, which would
// otherwise drop keyboard focus to <body> on every interaction)
// ---------------------------------------------------------------------------

function focusKey(el: HTMLElement): string | null {
  if (el.id) return `id:${el.id}`;
  const label = el.getAttribute("aria-label");
  if (label) return `aria:${label}`;
  const title = el.getAttribute("title");
  if (title) return `title:${title}`;
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (text) return `text:${el.tagName}:${text}`;
  return null;
}

function findByFocusKey(key: string): HTMLElement | null {
  if (key.startsWith("id:")) return document.getElementById(key.slice(3));
  if (key.startsWith("aria:")) {
    return document.querySelector(`[aria-label="${CSS.escape(key.slice(5))}"]`);
  }
  if (key.startsWith("title:")) {
    return document.querySelector(`[title="${CSS.escape(key.slice(6))}"]`);
  }
  if (key.startsWith("text:")) {
    const rest = key.slice(5);
    const colon = rest.indexOf(":");
    const tag = rest.slice(0, colon).toLowerCase();
    const text = rest.slice(colon + 1);
    for (const el of document.querySelectorAll<HTMLElement>(tag)) {
      if ((el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80) === text) {
        return el;
      }
    }
  }
  return null;
}

/** Run a DOM rebuild, then restore focus to the equivalent control (same
    id / aria-label / title / text) when the focused one was destroyed. */
function withFocusRestore(fn: () => void): void {
  const active = document.activeElement as HTMLElement | null;
  const key = active && active !== document.body ? focusKey(active) : null;
  fn();
  if (key) {
    const next = findByFocusKey(key);
    if (next && next !== document.activeElement) next.focus();
  }
}

// ---------------------------------------------------------------------------
// Loom reachability — tracks reality both ways instead of latching the
// startup probe. Any successful Loom call marks the server reachable;
// a connection failure marks it unreachable. The server-dependent views
// re-render only when the state actually changes (or on the first probe).
// ---------------------------------------------------------------------------

function isLoomConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Loom is unavailable|Failed to fetch|NetworkError|ECONNREFUSED/i.test(msg);
}

function setLoomReachable(reachable: boolean) {
  const changed = loomStatusKnown && loomReachable !== reachable;
  const firstProbe = !loomStatusKnown;
  loomReachable = reachable;
  loomStatusKnown = true;
  renderStatusPill();
  if (changed || firstProbe) {
    renderWorkDetail();
    renderAgents();
    renderArtifacts();
    renderInspectorContext();
  }
}

// ---------------------------------------------------------------------------
// Work list (left catalogue)
// ---------------------------------------------------------------------------

function renderWorkList() {
  withFocusRestore(() => {
    const list = document.querySelector<HTMLElement>("#work-list");
    if (!list) return;
    list.innerHTML = "";
    for (const item of workItems) {
      const li = document.createElement("li");
      li.dataset.title = item.title.toLowerCase();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "work-row" + (item.id === selectedWorkId ? " selected" : "");
      btn.setAttribute("aria-pressed", String(item.id === selectedWorkId));

      const dot = document.createElement("span");
      dot.className = `work-dot ${item.status}`;
      dot.title = item.status === "active" ? "Active" : "Paused";
      const title = document.createElement("span");
      title.className = "work-title";
      title.textContent = item.title;
      title.title = item.title;
      const time = document.createElement("span");
      time.className = "work-time";
      time.textContent = timeLabel(item);

      btn.append(dot, title, time);
      btn.addEventListener("click", () => selectWork(item.id));
      li.append(btn);
      list.append(li);
    }

    const active = workItems.filter((w) => w.status === "active").length;
    const paused = workItems.filter((w) => w.status === "paused").length;
    const counts = $("#work-counts");
    if (counts) {
      counts.textContent =
        workItems.length === 0
          ? "No work yet"
          : `${active} active · ${paused} paused`;
    }

    applySearchFilter(($("#search-input") as HTMLInputElement).value);
  });
}

/** Select a work item. A click from the catalogue navigates to Work so the
    detail is visible; the initial selection during load does not. */
function selectWork(id: string, navigate = true) {
  selectedWorkId = id;
  renderWorkList();
  renderWorkDetail();
  renderInspectorContext();
  renderChatScope();
  syncSessionToWork();
  void loadWorkArtifacts(id);
  if (navigate && mode !== "work") setMode("work");
  if (isLeftDrawer()) closeLeftDrawer(false);
}

// ---------------------------------------------------------------------------
// Intent header, pinned above the work detail in Work mode (Concept B,
// "Intent lives as pinned header"). Shows the active intent: what the
// person wants, why, what "done" means, and how much freedom the
// system has. One intent owns many pieces of work.
// ---------------------------------------------------------------------------

/** Autonomy levels from the interaction model: L1 Manual, L2 Assisted,
    L3 Collaborative, L4 Delegated. */
const AUTONOMY_LEVELS: Record<IntentAutonomy, { level: number; label: string }> = {
  manual: { level: 1, label: "Manual" },
  assisted: { level: 2, label: "Assisted" },
  collaborative: { level: 3, label: "Collaborative" },
  delegated: { level: 4, label: "Delegated" },
};

function autonomyLabel(a: IntentAutonomy): string {
  const entry = AUTONOMY_LEVELS[a];
  return entry ? `L${entry.level} · ${entry.label}` : String(a);
}

function activeIntent(): Intent | null {
  return intents.find((i) => i.id === activeIntentId) ?? null;
}

/** Reload intents from the backend (or the browser fallback) and
    re-render the pinned header. */
async function refreshIntents(): Promise<void> {
  try {
    const list = await getIntents();
    intents = list.intents;
    activeIntentId = list.active_intent_id;
    intentsLoadError = null;
  } catch (err) {
    intentsLoadError = `Could not load intents: ${err instanceof Error ? err.message : String(err)}`;
  }
  // Never rebuild an open editor: it is built from the stored intent and
  // a re-render would drop the user's unsaved typing. The save/cancel
  // paths re-render once the editor closes.
  if (!intentEditor) renderIntentHeader();
}

function renderIntentHeader() {
  withFocusRestore(() => {
    const header = document.querySelector<HTMLElement>("#intent-header");
    if (!header) return;
    header.innerHTML = "";
    if (intentsLoadError) {
      const err = document.createElement("p");
      err.className = "field-error";
      err.textContent = intentsLoadError;
      header.append(err);
    }
    if (intentEditor) {
      header.append(buildIntentEditor(intentEditor));
      return;
    }
    if (intents.length === 0) {
      header.append(buildIntentEmptyState());
      return;
    }
    const active = activeIntent();
    if (!active) {
      header.append(buildIntentChooser());
      return;
    }
    header.append(buildIntentSummary(active));
  });
}

/** No intents at all: one line invites creating one. */
function buildIntentEmptyState(): HTMLElement {
  const root = document.createElement("div");
  root.className = "intent-empty";
  const label = document.createElement("p");
  label.className = "intent-label";
  label.textContent = "Intent";
  const prompt = document.createElement("p");
  prompt.className = "intent-empty-prompt";
  prompt.textContent = "What are you trying to do?";
  const form = document.createElement("form");
  form.className = "intent-empty-form";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "State the intent, in one line…";
  input.setAttribute("aria-label", "New intent");
  const create = document.createElement("button");
  create.type = "submit";
  create.className = "btn";
  create.textContent = "Create intent";
  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;
  form.append(input, create, error);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statement = input.value.trim();
    if (!statement) return;
    clearFieldError(error);
    let createdId: string | null = null;
    let activated = false;
    try {
      createdId = pendingCreatedIntent?.statement === statement
        ? pendingCreatedIntent.id
        : (await createIntent({ statement })).id;
      pendingCreatedIntent = { id: createdId, statement };
      await setActiveIntent(createdId);
      activated = true;
      pendingCreatedIntent = null;
      await refreshIntents();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      showFieldError(
        error,
        createdId && !activated
          ? `Intent created, but it could not be made active: ${detail}`
          : `Could not create the intent: ${detail}`,
      );
    }
  });
  root.append(label, prompt, form);
  return root;
}

/** Intents exist but none is active: choose one. */
function buildIntentChooser(): HTMLElement {
  const root = document.createElement("div");
  root.className = "intent-summary";
  const label = document.createElement("p");
  label.className = "intent-label";
  label.textContent = "Intent";
  const text = document.createElement("p");
  text.className = "intent-why";
  text.textContent = "No active intent. Choose one to work on.";
  const actions = document.createElement("div");
  actions.className = "intent-actions";
  actions.append(buildIntentSwitchSelect(), newIntentButton());
  root.append(label, text, actions);
  return root;
}

/** Dropdown of all intents; picking one makes it the active intent. */
function buildIntentSwitchSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "autonomy-select";
  select.setAttribute("aria-label", "Switch active intent");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Switch intent…";
  select.append(placeholder);
  for (const intent of intents) {
    const opt = document.createElement("option");
    opt.value = intent.id;
    opt.textContent = intent.statement;
    if (intent.id === activeIntentId) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", async () => {
    if (!select.value) return;
    try {
      await setActiveIntent(select.value);
      intentEditor = null;
      await refreshIntents();
    } catch (err) {
      addChatError(
        `Could not switch intent: ${err instanceof Error ? err.message : String(err)}`,
      );
      renderIntentHeader();
    }
  });
  return select;
}

function newIntentButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.textContent = "New intent";
  btn.addEventListener("click", () => {
    intentEditor = { mode: "create" };
    renderIntentHeader();
    document
      .querySelector<HTMLInputElement>("#intent-header .intent-statement-input")
      ?.focus();
  });
  return btn;
}

/** The active intent: statement, version badge, acceptance checklist,
    autonomy label, status. */
function buildIntentSummary(intent: Intent): HTMLElement {
  const root = document.createElement("div");
  root.className = "intent-summary";

  const label = document.createElement("p");
  label.className = "intent-label";
  label.textContent = "Intent";
  root.append(label);

  const statement = document.createElement("p");
  statement.className = "intent-statement";
  statement.textContent = intent.statement;
  root.append(statement);

  if (intent.why) {
    const why = document.createElement("p");
    why.className = "intent-why";
    why.textContent = intent.why;
    root.append(why);
  }

  const badges = document.createElement("div");
  badges.className = "intent-badges";
  const version = document.createElement("span");
  version.className = "intent-badge";
  version.textContent = `v${intent.version}`;
  version.title = "Version. Editing the statement, why, or autonomy creates a new version.";
  const autonomy = document.createElement("span");
  autonomy.className = "intent-badge";
  autonomy.textContent = autonomyLabel(intent.autonomy);
  const status = document.createElement("span");
  status.className = "intent-badge" + (intent.status === "done" ? " done" : "");
  status.textContent = intent.status === "done" ? "Done" : "Active";
  badges.append(version, autonomy, status);
  root.append(badges);

  // Acceptance criteria are managed in the editor; the catalogue header
  // shows only their progress so the work list keeps the room.
  const criteria = intent.acceptance ?? [];
  if (criteria.length > 0) {
    const done = criteria.filter((c) => c.done).length;
    const progress = document.createElement("p");
    progress.className = "intent-progress";
    progress.textContent = `${done} of ${criteria.length} acceptance criteria met`;
    root.append(progress);
  } else {
    const none = document.createElement("p");
    none.className = "intent-progress";
    none.textContent = "No acceptance criteria yet.";
    root.append(none);
  }

  const actions = document.createElement("div");
  actions.className = "intent-actions";
  actions.append(buildIntentSwitchSelect());
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "btn";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => {
    intentEditor = { mode: "edit", id: intent.id };
    renderIntentHeader();
    document
      .querySelector<HTMLInputElement>("#intent-header .intent-statement-input")
      ?.focus();
  });
  actions.append(edit, newIntentButton());
  root.append(actions);
  return root;
}

/** One row of the editor's acceptance list: done box, text, remove. */
function buildCriterionRow(text: string, done: boolean): HTMLLIElement {
  const li = document.createElement("li");
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = done;
  box.setAttribute("aria-label", "Criterion done");
  const input = document.createElement("input");
  input.type = "text";
  input.value = text;
  input.setAttribute("aria-label", "Acceptance criterion");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-btn small";
  remove.title = "Remove criterion";
  remove.setAttribute("aria-label", `Remove criterion: ${text}`);
  remove.textContent = "✕";
  remove.addEventListener("click", () => li.remove());
  li.append(box, input, remove);
  return li;
}

/** Read the editor's acceptance rows from the DOM (rows are added and
    removed in place, so the editor never rebuilds under the user's
    keystrokes). */
function readCriterionRows(list: HTMLUListElement): AcceptanceCriterion[] {
  const out: AcceptanceCriterion[] = [];
  for (const li of list.querySelectorAll("li")) {
    const text =
      (li.querySelector("input[type='text']") as HTMLInputElement)?.value ?? "";
    const done =
      (li.querySelector("input[type='checkbox']") as HTMLInputElement)?.checked ??
      false;
    if (text.trim()) out.push({ text: text.trim(), done });
  }
  return out;
}

/** Inline editor in the header area (no modal): statement, why,
    acceptance criteria, autonomy, status, plus the read-only version
    history and delete (edit mode only). */

/** ------------------------------------------------------------------
    Autonomy Dial — the visible dial for human agency.

    Moving down (tightening) is always instant.
    Moving up (loosening) requires a justification — the system never
    grants itself more freedom.

    Returns a container with:
      - current level badge (prominent)
      - four level buttons (manual → assisted → collaborative → delegated)
      - clicking a lower level applies immediately
      - clicking a higher level opens a justification dialog
      - autonomy history listed below
    ------------------------------------------------------------------ */

function buildAutonomyDial(
  current: IntentAutonomy,
  onChange: (next: IntentAutonomy, justification: string | null) => void,
  history: AutonomyChange[] = [],
): HTMLElement {
  const root = document.createElement("div");
  root.className = "autonomy-dial";

  // Current level badge — prominent.
  const currentBadge = document.createElement("div");
  currentBadge.className = "autonomy-current";
  const currentLabel = document.createElement("span");
  currentLabel.className = "autonomy-current-label";
  currentLabel.textContent = "Autonomy";
  const currentValue = document.createElement("span");
  currentValue.className = `autonomy-current-value level-${current}`;
  const currentEntry = AUTONOMY_LEVELS[current];
  currentValue.textContent = currentEntry
    ? `L${currentEntry.level} · ${currentEntry.label}`
    : String(current);
  currentBadge.append(currentLabel, currentValue);
  root.append(currentBadge);

  // Level buttons.
  const levels = document.createElement("div");
  levels.className = "autonomy-levels";
  const levelKeys = Object.keys(AUTONOMY_LEVELS) as IntentAutonomy[];
  for (const level of levelKeys) {
    const entry = AUTONOMY_LEVELS[level];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `autonomy-btn level-${level}` + (level === current ? " active" : "");
    btn.setAttribute("aria-label", `Set autonomy to ${entry.label}`);
    btn.textContent = `L${entry.level}`;
    btn.title = entry.label;
    const rank = entry.level - 1;
    const currentRank = (AUTONOMY_LEVELS[current]?.level ?? 3) - 1;
    btn.addEventListener("click", () => {
      if (rank === currentRank) return; // no change
      if (rank < currentRank) {
        // Moving down: instant, no justification needed.
        onChange(level, null);
      } else {
        // Moving up: open justification dialog.
        openAutonomyDialog({
          kind: "work", // set by caller
          id: "",
          current,
          target: level,
          onApply: (justification) => {
            onChange(level, justification);
            closeAutonomyDialog();
          },
        });
      }
    });
    levels.append(btn);
  }
  root.append(levels);

  // Autonomy history.
  if (history.length > 0) {
    const histLabel = document.createElement("p");
    histLabel.className = "autonomy-hist-label";
    histLabel.textContent = "Autonomy changes";
    root.append(histLabel);
    const histList = document.createElement("ul");
    histList.className = "autonomy-hist-list";
    for (const change of history.slice().reverse()) {
      const li = document.createElement("li");
      li.className = "autonomy-hist-item";
      const fromTo = document.createElement("span");
      fromTo.className = "autonomy-hist-from-to";
      const fromEntry = AUTONOMY_LEVELS[change.from as IntentAutonomy];
      const toEntry = AUTONOMY_LEVELS[change.to as IntentAutonomy];
      fromTo.textContent =
        fromEntry && toEntry
          ? `L${fromEntry.level} → L${toEntry.level}`
          : `${change.from} → ${change.to}`;
      const when = document.createElement("span");
      when.className = "autonomy-hist-when";
      when.textContent = change.at > 0 ? new Date(change.at * 1000).toLocaleString() : "—";
      li.append(fromTo, when);
      if (change.justification) {
        const just = document.createElement("span");
        just.className = "autonomy-hist-just";
        just.textContent = `"${change.justification}"`;
        li.append(just);
      }
      histList.append(li);
    }
    root.append(histList);
  }

  return root;
}

/** Open the autonomy justification dialog (for raising autonomy). */
function openAutonomyDialog(d: {
  kind: "intent" | "work";
  id: string;
  current: IntentAutonomy;
  target: IntentAutonomy;
  onApply: (justification: string | null) => void;
  onCancel?: () => void;
}): void {
  const overlay = document.createElement("div");
  overlay.id = "autonomy-dialog-overlay";
  overlay.className = "autonomy-dialog-overlay";
  const currentEntry = AUTONOMY_LEVELS[d.current] ?? AUTONOMY_LEVELS.collaborative;
  const targetEntry = AUTONOMY_LEVELS[d.target] ?? AUTONOMY_LEVELS.collaborative;
  overlay.innerHTML = `
    <div class="autonomy-dialog">
      <h3>Increase autonomy?</h3>
      <p>
        Moving from L${currentEntry.level} · ${currentEntry.label}
        to L${targetEntry.level} · ${targetEntry.label}
        gives the system more freedom. Why is more autonomy needed?
      </p>
      <textarea id="autonomy-justification" rows="3" placeholder="Enter your justification…"></textarea>
      <div class="autonomy-dialog-actions">
        <button type="button" class="btn ghost" id="autonomy-dialog-cancel">Cancel</button>
        <button type="button" class="btn" id="autonomy-dialog-apply">Apply</button>
      </div>
    </div>
  `;
  document.body.append(overlay);
  const ta = overlay.querySelector("#autonomy-justification") as HTMLTextAreaElement;
  ta.focus();
  overlay.querySelector("#autonomy-dialog-cancel")!.addEventListener("click", () => {
    closeAutonomyDialog();
    d.onCancel?.();
  });
  overlay.querySelector("#autonomy-dialog-apply")!.addEventListener("click", () => {
    d.onApply(ta.value.trim() || null);
    closeAutonomyDialog();
  });
  // Close on overlay click (but not on inner dialog clicks).
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeAutonomyDialog();
      d.onCancel?.();
    }
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAutonomyDialog();
      d.onCancel?.();
    }
  });
}

/** Close the autonomy justification dialog. */
function closeAutonomyDialog(): void {
  const overlay = document.getElementById("autonomy-dialog-overlay");
  if (overlay) overlay.remove();
}

/** Build the autonomy select field for the intent editor (replaced by dial). */
function buildAutonomyField(
  current: IntentAutonomy,
  history: AutonomyChange[],
  onChange: (next: IntentAutonomy, justification: string | null) => void,
): HTMLElement {
  const field = document.createElement("div");
  field.className = "intent-field";
  const label = document.createElement("span");
  label.className = "intent-field-label";
  label.textContent = "Autonomy";
  field.append(label);
  field.append(buildAutonomyDial(current, onChange, history));
  return field;
}

function buildIntentEditor(
  editor: { mode: "create" } | { mode: "edit"; id: string },
): HTMLElement {
  const existing =
    editor.mode === "edit" ? intents.find((i) => i.id === editor.id) : undefined;
  const form = document.createElement("form");
  form.className = "intent-editor";

  const heading = document.createElement("h3");
  heading.textContent = editor.mode === "create" ? "New intent" : "Edit intent";
  form.append(heading);

  const statementField = document.createElement("label");
  statementField.className = "intent-field";
  const statementLabel = document.createElement("span");
  statementLabel.className = "intent-field-label";
  statementLabel.textContent = "What are you trying to do?";
  const statementInput = document.createElement("input");
  statementInput.type = "text";
  statementInput.className = "intent-statement-input";
  statementInput.value = existing?.statement ?? "";
  statementInput.setAttribute("aria-label", "Intent statement");
  statementField.append(statementLabel, statementInput);
  form.append(statementField);

  const whyField = document.createElement("label");
  whyField.className = "intent-field";
  const whyLabel = document.createElement("span");
  whyLabel.className = "intent-field-label";
  whyLabel.textContent = "Why does it matter?";
  const whyInput = document.createElement("textarea");
  whyInput.rows = 2;
  whyInput.value = existing?.why ?? "";
  whyInput.setAttribute("aria-label", "Why this intent matters");
  whyField.append(whyLabel, whyInput);
  form.append(whyField);

  const accField = document.createElement("div");
  accField.className = "intent-field";
  const accLabel = document.createElement("span");
  accLabel.className = "intent-field-label";
  accLabel.textContent = "Acceptance: what done means";
  const accList = document.createElement("ul");
  accList.className = "intent-criteria-edit";
  for (const c of existing?.acceptance ?? []) {
    accList.append(buildCriterionRow(c.text, c.done));
  }
  const accAdd = document.createElement("div");
  accAdd.className = "add-criterion";
  const accInput = document.createElement("input");
  accInput.type = "text";
  accInput.placeholder = "Add a criterion…";
  accInput.setAttribute("aria-label", "New acceptance criterion");
  const accAddBtn = document.createElement("button");
  accAddBtn.type = "button";
  accAddBtn.className = "btn ghost";
  accAddBtn.textContent = "Add";
  accAddBtn.addEventListener("click", () => {
    const text = accInput.value.trim();
    if (!text) return;
    accList.append(buildCriterionRow(text, false));
    accInput.value = "";
    accInput.focus();
  });
  accAdd.append(accInput, accAddBtn);
  accField.append(accLabel, accList, accAdd);
  form.append(accField);

  const row = document.createElement("div");
  row.className = "intent-editor-row";
  // The dial changes a live intent: a not-yet-created intent has no id
  // for updateIntent, so in create mode the dial is not shown at all.
  if (editor.mode === "edit" && existing) {
    const target = existing;
    const autonomyField = buildAutonomyField(
      target.autonomy,
      target.autonomy_history ?? [],
      async (next, justification) => {
        try {
          await updateIntent({
            id: target.id,
            statement: statementInput.value.trim() || target.statement,
            why: whyInput.value.trim() || null,
            autonomy: next,
            status: statusSelect.value as "active" | "done",
            justification,
          });
          // Re-render with updated history.
          intentEditor = { mode: "edit", id: target.id };
          renderIntentHeader();
        } catch (err) {
          showFieldError(error, err instanceof Error ? err.message : String(err));
        }
      },
    );
    row.append(autonomyField);
  } else {
    const autonomyNote = document.createElement("p");
    autonomyNote.className = "wd-sub-label";
    autonomyNote.textContent =
      "Autonomy starts at Collaborative; change it after creating the intent.";
    row.append(autonomyNote);
  }
  const statusField = document.createElement("label");
  statusField.className = "intent-field inline";
  const statusLabelEl = document.createElement("span");
  statusLabelEl.className = "intent-field-label";
  statusLabelEl.textContent = "Status";
  const statusSelect = document.createElement("select");
  statusSelect.className = "autonomy-select";
  statusSelect.setAttribute("aria-label", "Intent status");
  for (const s of ["active", "done"] as const) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = capitalize(s);
    if ((existing?.status ?? "active") === s) opt.selected = true;
    statusSelect.append(opt);
  }
  statusField.append(statusLabelEl, statusSelect);
  row.append(statusField);
  form.append(row);

  if (existing && existing.history.length > 0) {
    const hist = document.createElement("div");
    hist.className = "intent-history";
    const histLabel = document.createElement("p");
    histLabel.className = "intent-field-label";
    histLabel.textContent = "Previous versions";
    hist.append(histLabel);
    const ul = document.createElement("ul");
    for (const h of existing.history) {
      const li = document.createElement("li");
      const when = h.updated_at > 0 ? ` (${formatUnix(h.updated_at)})` : "";
      li.textContent = `v${h.version}: ${h.statement}${when}`;
      ul.append(li);
    }
    hist.append(ul);
    form.append(hist);
  }

  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;

  const actions = document.createElement("div");
  actions.className = "intent-editor-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn";
  save.textContent = editor.mode === "create" ? "Create intent" : "Save changes";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn ghost";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    intentEditor = null;
    pendingCreatedIntent = null;
    renderIntentHeader();
  });
  actions.append(save, cancel);
  if (editor.mode === "edit" && existing) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn ghost danger";
    del.textContent = "Delete intent";
    del.addEventListener("click", async () => {
      clearFieldError(error);
      del.disabled = true;
      try {
        await deleteIntent(existing.id);
        intentEditor = null;
        await refreshIntents();
        renderWorkDetail();
      } catch (err) {
        del.disabled = false;
        showFieldError(error, err instanceof Error ? err.message : String(err));
      }
    });
    actions.append(del);
  }
  form.append(actions, error);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const statement = statementInput.value.trim();
    if (!statement) {
      showFieldError(error, "State the intent in one line first.");
      statementInput.focus();
      return;
    }
    clearFieldError(error);
    save.disabled = true;
    const criteria = readCriterionRows(accList);
    const why = whyInput.value.trim();
    const status = statusSelect.value as "active" | "done";
    // For new intents, autonomy defaults to "collaborative" (set by the
    // backend). For edits, autonomy is changed via the dial directly.
    const autonomy = editor.mode === "create" ? "collaborative" : existing!.autonomy;
    let createdId: string | null = null;
    let activated = false;
    let intentSaved = false;
    try {
      if (editor.mode === "create") {
        createdId = pendingCreatedIntent?.statement === statement
          ? pendingCreatedIntent.id
          : (await createIntent({ statement, why, acceptance: criteria, autonomy })).id;
        pendingCreatedIntent = { id: createdId, statement };
        await setActiveIntent(createdId);
        activated = true;
        pendingCreatedIntent = null;
        if (status === "done") {
          await updateIntent({ id: createdId, status: "done" });
        }
        intentEditor = null;
        await refreshIntents();
      } else if (existing) {
        const updated = await updateIntent({
          id: existing.id,
          statement,
          why,
          status,
        });
        intentSaved = true;
        // Acceptance is a separate call and never bumps the version, and
        // the backend no-ops an update whose content did not change, so
        // retrying after a partial save creates no spurious version.
        const criteriaChanged =
          JSON.stringify(updated.acceptance) !== JSON.stringify(criteria);
        if (criteriaChanged) {
          await setIntentAcceptance({ id: existing.id, criteria });
        }
        intentEditor = null;
        await refreshIntents();
      }
    } catch (err) {
      save.disabled = false;
      const detail = err instanceof Error ? err.message : String(err);
      showFieldError(
        error,
        createdId && !activated
          ? `Intent created, but it could not be made active: ${detail}`
          : createdId && activated
            ? `Intent created and activated, but the status could not be set to Done: ${detail}`
            : intentSaved
              ? `Intent saved, but the acceptance criteria failed to save: ${detail}`
              : `Could not save the intent: ${detail}`,
      );
    }
  });

  return form;
}

// ---------------------------------------------------------------------------
// Work summary component (spec section 6) — the detail view's header.
// Title on its own first row, metadata on its own line, controls below
// the text. Never clamps the full title.
// ---------------------------------------------------------------------------

function showFieldError(slot: HTMLElement | null, message: string) {
  if (!slot) return;
  slot.textContent = message;
  slot.hidden = false;
}

function clearFieldError(slot: HTMLElement | null) {
  if (!slot) return;
  slot.textContent = "";
  slot.hidden = true;
}

/** Build the summary block for one work item. The title owns its row, the
    metadata owns the next, and every control sits below the text so a
    narrow pane never squeezes the selected title. */
function buildWorkSummary(item: WorkItem): HTMLElement {
  const root = document.createElement("section");
  root.className = "work-summary";
  root.setAttribute("aria-label", "Selected work");

  const top = document.createElement("div");
  top.className = "ws-top";
  const dot = document.createElement("span");
  dot.className = `work-dot ${item.status}`;
  dot.title = item.status === "active" ? "Active" : "Paused";
  const title = document.createElement("h3");
  title.className = "ws-title";
  title.textContent = item.title;
  top.append(dot, title);
  root.append(top);

  const meta = document.createElement("p");
  meta.className = "ws-meta";
  meta.textContent = metaLabel(item);
  root.append(meta);

  const controls = document.createElement("div");
  controls.className = "ws-controls";

  const planning = document.createElement("label");
  planning.className = "ws-planning";
  const planningLabel = document.createElement("span");
  planningLabel.className = "ctl-label";
  planningLabel.textContent = "Planning mode:";
  const select = document.createElement("select");
  select.className = "autonomy-select";
  select.setAttribute("aria-label", "Planning mode");
  select.title =
    "A local planning preference. It does not start, pause, or change how an agent behaves.";
  for (const level of Object.keys(AUTONOMY_LEVELS) as IntentAutonomy[]) {
    const entry = AUTONOMY_LEVELS[level];
    const opt = document.createElement("option");
    opt.value = level;
    opt.textContent = `${entry.label} (L${entry.level})`;
    if (item.autonomy === level) opt.selected = true;
    select.append(opt);
  }
  planning.append(planningLabel, select);
  controls.append(planning);

  const stateBtn = document.createElement("button");
  stateBtn.type = "button";
  stateBtn.className = "btn";
  stateBtn.textContent = item.status === "active" ? "Mark paused" : "Mark active";
  stateBtn.title =
    "Local planning state, saved on this device. It does not pause a running agent.";

  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;

  const applyAutonomy = async (
    next: IntentAutonomy,
    justification: string | null,
  ) => {
    clearFieldError(error);
    try {
      const updated = await setWorkAutonomy(
        item.id,
        next as WorkItem["autonomy"],
        justification,
      );
      workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
      renderWorkList();
      renderWorkDetail();
    } catch (err) {
      showFieldError(
        error,
        `Could not save the planning mode: ${err instanceof Error ? err.message : String(err)}`,
      );
      select.value = item.autonomy;
    }
  };

  select.addEventListener("change", () => {
    const next = select.value as IntentAutonomy;
    const currentRank = AUTONOMY_LEVELS[item.autonomy].level;
    const nextRank = AUTONOMY_LEVELS[next].level;
    if (nextRank > currentRank) {
      openAutonomyDialog({
        kind: "work",
        id: item.id,
        current: item.autonomy,
        target: next,
        onApply: (justification) => {
          void applyAutonomy(next, justification);
        },
        onCancel: () => {
          select.value = item.autonomy;
        },
      });
    } else {
      void applyAutonomy(next, null);
    }
  });

  stateBtn.addEventListener("click", async () => {
    clearFieldError(error);
    const next = item.status === "active" ? "paused" : "active";
    try {
      const updated = await setWorkStatus(item.id, next);
      workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
      renderWorkList();
      renderWorkDetail();
      renderInspectorContext();
    } catch (err) {
      showFieldError(
        error,
        `Could not save the state: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  controls.append(stateBtn, error);
  root.append(controls);

  const note = document.createElement("p");
  note.className = "ws-note";
  note.textContent =
    "Local planning only. These settings are saved on this device; they do not pause a running agent or change how agents behave.";
  root.append(note);

  return root;
}

// ---------------------------------------------------------------------------
// Work detail view — the selected work, in reading order: title and state,
// planning preference and its supported local action, goal and success
// criteria, artifacts, evidence. The catalogue lives only on the left.
// ---------------------------------------------------------------------------

function renderWorkDetail() {
  withFocusRestore(() => {
    const wrap = document.querySelector<HTMLElement>("#work-detail");
    if (!wrap) return;
    wrap.innerHTML = "";
    const item = workItems.find((w) => w.id === selectedWorkId);
    $("#objective-btn").hidden = !item;
    $("#objective-title").textContent = item?.title ?? "";
    $("#objective-btn").title = item ? `Open in Work view: ${item.title}` : "";

    if (workItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wd-empty";
      const text = document.createElement("p");
      text.textContent =
        "No work yet. Enter a title above to create your first piece of work.";
      empty.append(text);
      wrap.append(empty);
      return;
    }

    if (!item) {
      const empty = document.createElement("div");
      empty.className = "wd-empty";
      const text = document.createElement("p");
      text.textContent = isLeftDrawer()
        ? "No work selected. Open Work to choose an item from the catalogue."
        : "No work selected. Choose an item from the work catalogue on the left.";
      empty.append(text);
      wrap.append(empty);
      return;
    }

    wrap.append(buildWorkSummary(item));
    wrap.append(buildSuccessCriteria(item));
    wrap.append(buildArtifactsSection(item));
    wrap.append(buildEvidenceSection(item.id));

    // Real Loom workflows stay available, but in a collapsed supporting
    // section so they never crowd the selected work.
    const supporting = document.createElement("details");
    supporting.className = "supporting";
    const summary = document.createElement("summary");
    summary.textContent = "Workflows and recent runs";
    supporting.append(summary);
    supporting.append(buildWorkflowsSection());
    wrap.append(supporting);

    const sub = document.getElementById("work-mode-sub");
    if (sub) {
      sub.textContent =
        "The selected work: what done means, what it produced, and the evidence behind it.";
    }
  });
}

// ---- Success criteria and goal (editable, local) ----

function buildSuccessCriteria(item: WorkItem): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  section.setAttribute("aria-label", "Goal and success criteria");
  const h = document.createElement("h4");
  h.textContent = "Goal and success criteria";
  section.append(h);

  // The goal is the work's intent. Clicking it makes that intent active;
  // the catalogue header updates to the same state.
  const intent = item.intent_id
    ? intents.find((i) => i.id === item.intent_id)
    : undefined;
  if (intent) {
    const goalRow = document.createElement("div");
    goalRow.className = "ws-intent";
    const intentLabel = document.createElement("span");
    intentLabel.className = "ws-intent-label";
    intentLabel.textContent = "Goal:";
    const intentBtn = document.createElement("button");
    intentBtn.type = "button";
    intentBtn.className = "ws-intent-link";
    intentBtn.textContent = intent.statement;
    intentBtn.title = "Make this intent the active one";
    intentBtn.addEventListener("click", async () => {
      try {
        await setActiveIntent(intent.id);
        intentEditor = null;
        await refreshIntents();
        renderWorkDetail();
      } catch (err) {
        addChatError(
          `Could not switch intent: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    goalRow.append(intentLabel, intentBtn);
    section.append(goalRow);
  } else {
    section.append(emptyP("No intent is linked to this work, so it has no stated goal."));
  }

  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;

  const criteria = item.success_criteria ?? [];
  if (criteria.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No success criteria yet. Add one to define what done means for this work.";
    section.append(p);
  } else {
    const ul = document.createElement("ul");
    ul.className = "criteria-list";
    criteria.forEach((c, i) => {
      const li = document.createElement("li");
      const text = document.createElement("span");
      text.textContent = c;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn small";
      remove.title = "Remove criterion";
      remove.setAttribute("aria-label", `Remove criterion: ${c}`);
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        // Remove by index: duplicate criterion text removes only one copy.
        void saveCriteria(
          item.id,
          criteria.filter((_, idx) => idx !== i),
          error,
        );
      });
      li.append(text, remove);
      ul.append(li);
    });
    section.append(ul);
  }

  const form = document.createElement("form");
  form.className = "add-criterion";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Add a success criterion…";
  input.setAttribute("aria-label", "New success criterion");
  const add = document.createElement("button");
  add.type = "submit";
  add.className = "btn ghost";
  add.textContent = "Add";
  form.append(input, add);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    clearFieldError(error);
    // Disable while saving so two rapid submits cannot race on the same
    // stale snapshot; the input clears only after a successful save.
    input.disabled = true;
    add.disabled = true;
    const ok = await saveCriteria(item.id, [...criteria, v], error);
    if (ok) {
      input.value = "";
    } else {
      input.disabled = false;
      add.disabled = false;
    }
  });
  section.append(form, error);
  return section;
}

/** In-flight criteria saves, per work item: a second save while one is
    running would read the same stale snapshot and drop a criterion. */
const criteriaSaving = new Set<string>();

async function saveCriteria(
  workId: string,
  criteria: string[],
  errorSlot?: HTMLElement | null,
): Promise<boolean> {
  if (criteriaSaving.has(workId)) return false;
  criteriaSaving.add(workId);
  try {
    const updated = await setWorkSuccessCriteria(workId, criteria);
    workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
    renderWorkDetail();
    return true;
  } catch (err) {
    const message = `Could not save the success criteria: ${err instanceof Error ? err.message : String(err)}`;
    if (errorSlot?.isConnected) showFieldError(errorSlot, message);
    else addChatError(message);
    return false;
  } finally {
    criteriaSaving.delete(workId);
  }
}


// ---- Workflows (real Loom server) ----

function buildWorkflowsSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const head = document.createElement("div");
  head.className = "wd-section-head";
  const h = document.createElement("h4");
  h.textContent = "Workflows";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "icon-btn small";
  refresh.title = "Refresh workflows";
  refresh.setAttribute("aria-label", "Refresh workflows");
  refresh.textContent = "↻";
  refresh.addEventListener("click", () => refreshWorkflows());
  head.append(h, refresh);
  section.append(head);

  if (workflowError) {
    const error = document.createElement("p");
    error.className = "field-error inline-error";
    error.textContent = workflowError;
    section.append(error);
  }

  if (!loomStatusKnown) {
    section.append(emptyP("Checking the Loom server…"));
    return section;
  }
  if (!loomReachable) {
    section.append(emptyP("The Loom server is offline. Workflows are not available."));
    return section;
  }
  if (workflows.length === 0) {
    section.append(emptyP("No workflows saved on the Loom server."));
  } else {
    const ul = document.createElement("ul");
    ul.className = "workflow-list";
    for (const wf of workflows) {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "workflow-info";
      const name = document.createElement("strong");
      name.textContent = wf.name;
      info.append(name);
      const desc = wf.description || wf.type;
      if (desc) {
        const span = document.createElement("span");
        span.textContent = desc;
        info.append(span);
      }
      const run = document.createElement("button");
      run.type = "button";
      run.className = "btn";
      run.textContent = runningWorkflow === wf.name ? "Running…" : "Run";
      run.disabled = runningWorkflow !== null;
      run.addEventListener("click", () => runWorkflow(wf.name));
      li.append(info, run);
      if (runningWorkflow === wf.name && workflowStreamState) {
        const progress = document.createElement("p");
        progress.className = "workflow-progress";
        progress.textContent = `${workflowStreamState.progress}%${workflowStreamState.message ? ` — ${workflowStreamState.message}` : ""}`;
        li.append(progress);
      }

      // Cancel/dismiss: stops polling and clears the running state.
      // The server-side execution continues (no cancel endpoint exists),
      // so this is honest about the limit instead of pretending control.
      if (runningWorkflow === wf.name) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn ghost danger";
        cancel.textContent = "Dismiss";
        cancel.title = "Stop tracking this run. The server-side execution continues.";
        cancel.addEventListener("click", () => {
          cancelWorkflow = true;
          currentRunSeq = ++runSeq;
          runningWorkflow = null;
          renderWorkDetail();
          setSphereState("idle");
        });
        li.append(cancel);
      }
      ul.append(li);
    }
    section.append(ul);
  }

  // Executions are workspace-global (the server does not attribute them
  // to a work item), so the heading says so.
  const execLabel = document.createElement("p");
  execLabel.className = "wd-sub-label";
  execLabel.textContent = "Recent executions (all work)";
  section.append(execLabel);
  if (executions.length === 0) {
    section.append(emptyP("No executions yet. Run a workflow to see its execution here."));
  } else {
    const ul = document.createElement("ul");
    ul.className = "execution-list";
    for (const ex of executions.slice(0, executionsShown)) {
      const li = document.createElement("li");
      const status = document.createElement("span");
      status.className = `exp-status ${ex.status}`;
      status.textContent = ex.status;
      const name = document.createElement("span");
      name.className = "execution-name";
      name.textContent =
        executionWorkflowNames.get(ex.id) ?? ex.result?.pattern_type ?? "Workflow";
      const when = document.createElement("span");
      when.className = "execution-time";
      when.textContent = formatUnix(ex.started_at);
      const id = document.createElement("span");
      id.className = "execution-id";
      id.textContent = ex.id.slice(0, 12);
      li.append(status, name, when, id);
      if (ex.error) {
        const err = document.createElement("span");
        err.className = "execution-error";
        err.textContent = ex.error;
        li.append(err);
      }
      ul.append(li);
    }
    section.append(ul);
    if (executionsShown < executions.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "btn ghost";
      more.textContent = `Show more (${executions.length - executionsShown} remaining)`;
      more.addEventListener("click", () => {
        executionsShown += EXECUTIONS_PAGE;
        renderWorkDetail();
      });
      section.append(more);
    }
    if (executions.length === EXECUTIONS_LIMIT) {
      const note = document.createElement("p");
      note.className = "wd-sub-label";
      note.textContent =
        "Showing 500 executions — the list is capped at 500, there may be more.";
      section.append(note);
    }
  }

  // Workflow schedules (§13): HTTP-bound, so no transport decision is
  // needed. Listed beside the workflows they run.
  const schedHead = document.createElement("div");
  schedHead.className = "wd-section-head";
  const schedH = document.createElement("h4");
  schedH.textContent = "Schedules";
  const schedNew = document.createElement("button");
  schedNew.type = "button";
  schedNew.className = "btn ghost";
  schedNew.textContent = "New schedule";
  schedNew.addEventListener("click", openScheduleDialog);
  schedHead.append(schedH, schedNew);
  section.append(schedHead);
  const schedList = document.createElement("div");
  schedList.id = "schedules-list";
  section.append(schedList);
  if (workflowSchedules.length === 0 && !schedulesLoadError) void refreshSchedules();
  renderSchedules();
  return section;
}

async function refreshExecutionsList() {
  try {
    executions = await listWorkflowExecutions();
    executionsShown = EXECUTIONS_PAGE;
    setLoomReachable(true);
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    /* keep the previous list */
  }
}

async function refreshWorkflows() {
  try {
    workflows = await listWorkflows();
    setLoomReachable(true);
  } catch (err) {
    workflows = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  await refreshExecutionsList();
  renderWorkDetail();
}

/** Poll one execution until it leaves a running state (or attempts run
    out), so the list stops showing a stale status after a run. Stops early
    if the human dismisses the run. */
async function pollWorkflowExecution(executionId: string) {
  for (let i = 0; i < 5; i++) {
    if (cancelWorkflow) return;
    const current = executions.find((e) => e.id === executionId);
    if (current && current.status !== "pending" && current.status !== "running") {
      return;
    }
    await new Promise((r) => window.setTimeout(r, 1500));
    try {
      const ex = await getWorkflowExecution(executionId);
      setLoomReachable(true);
      const idx = executions.findIndex((e) => e.id === executionId);
      if (idx >= 0) executions[idx] = ex;
      else executions = [ex, ...executions];
    } catch (err) {
      if (isLoomConnectionError(err)) setLoomReachable(false);
      return;
    }
  }
}

async function runWorkflow(name: string) {
  if (runningWorkflow) return;
  const token = ++runSeq;
  currentRunSeq = token;
  runningWorkflow = name;
  cancelWorkflow = false;
  workflowError = null;
  workflowStreamState = null;
  const startedFromWork = selectedWorkId;
  renderWorkDetail();
  setSphereState("executing");
  // Streaming first (§14.2): live progress instead of one blocking wait.
  // The stream's final event carries the execution id for the post-run
  // polling; the unary path stays as the fallback.
  const requestId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await executeWorkflowStream(requestId, name);
  } catch {
    await runWorkflowUnary(name, token, startedFromWork);
    return;
  }
  workflowStreamActive = requestId;
  renderWorkDetail();
}

function finishWorkflowRun(
  token: number,
  startedFromWork: string | null,
  executionId: string | null,
  error: string | null,
) {
  if (token !== currentRunSeq) return;
  workflowStreamActive = null;
  workflowStreamState = null;
  void (async () => {
    if (error === null) {
      setLoomReachable(true);
      if (executionId) {
        executionWorkflowNames.set(executionId, runningWorkflow ?? "");
        if (startedFromWork) executionWorkIds.set(executionId, startedFromWork);
      }
      try {
        await refreshExecutionsList();
        if (executionId) await pollWorkflowExecution(executionId);
      } catch {
        /* the executions list refresh is best-effort */
      }
      runningWorkflow = null;
      cancelWorkflow = false;
      renderWorkDetail();
      renderEvidence();
      setSphereState("completed");
      window.setTimeout(() => {
        if (sphereState === "completed") setSphereState("idle");
      }, 3000);
    } else {
      try { await refreshExecutionsList(); } catch { /* best-effort */ }
      runningWorkflow = null;
      cancelWorkflow = false;
      workflowError = `Workflow “${runningWorkflow ?? ""}” failed: ${error}`;
      renderWorkDetail();
      setSphereState("error");
      if (isLoomConnectionError(new Error(error))) setLoomReachable(false);
    }
  })();
}

function handleWorkflowStreamEvent(p: StreamEnvelope<WorkflowProgressEvent>) {
  if (!workflowStreamActive || p.requestId !== workflowStreamActive) return;
  if (p.kind === "progress" && p.event) {
    workflowStreamState = {
      progress: p.event.progress ?? workflowStreamState?.progress ?? 0,
      message: p.event.message ?? "",
      executionId: p.event.execution_id ?? workflowStreamState?.executionId ?? null,
    };
    renderWorkDetail();
    return;
  }
  const executionId = workflowStreamState?.executionId ?? null;
  if (p.kind === "done") {
    finishWorkflowRun(currentRunSeq, selectedWorkId, executionId, null);
  } else if (p.kind === "cancelled") {
    runningWorkflow = null;
    cancelWorkflow = false;
    workflowStreamActive = null;
    workflowStreamState = null;
    renderWorkDetail();
    setSphereState("idle");
  } else {
    finishWorkflowRun(currentRunSeq, selectedWorkId, executionId, p.error ?? "stream failed");
  }
}

async function runWorkflowUnary(name: string, token: number, startedFromWork: string | null) {
  try {
    // execute_workflow returns the run's own result, so the UI can show
    // the run's actual output instead of only re-listing executions.
    const res = await executeWorkflow(name);
    if (token !== currentRunSeq) return;
    if (cancelWorkflow) {
      runningWorkflow = null;
      cancelWorkflow = false;
      renderWorkDetail();
      setSphereState("idle");
      return;
    }
    setLoomReachable(true);
    if (res.execution_id) {
      executionWorkflowNames.set(res.execution_id, name);
      if (startedFromWork) executionWorkIds.set(res.execution_id, startedFromWork);
      await refreshExecutionsList();
      await pollWorkflowExecution(res.execution_id);
    } else {
      await refreshExecutionsList();
    }
    if (token !== currentRunSeq) return;
    if (cancelWorkflow) {
      runningWorkflow = null;
      cancelWorkflow = false;
      renderWorkDetail();
      setSphereState("idle");
      return;
    }
    runningWorkflow = null;
    cancelWorkflow = false;
    renderWorkDetail();
    renderEvidence();
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    if (token !== currentRunSeq) return;
    await refreshExecutionsList();
    runningWorkflow = null;
    cancelWorkflow = false;
    workflowError = `Workflow “${name}” failed: ${err instanceof Error ? err.message : String(err)}`;
    renderWorkDetail();
    setSphereState("error");
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

// ---------------------------------------------------------------------------
// Session subscription, provider A/B, and workflow schedules (Phase 3–4)
// ---------------------------------------------------------------------------

/** Live session state: the backend forwards SessionUpdate events while a
    session is selected, so the detail pane reflects server-side changes
    without polling. */
async function ensureSessionSubscription() {
  const id = selectedSessionId;
  if (!id || !isTauri) return;
  if (sessionSubId === `sess-${id}`) return;
  sessionSubId = `sess-${id}`;
  try {
    await sessionSubscribe(sessionSubId, id);
  } catch {
    sessionSubId = null;
  }
}

function handleSessionEvent(p: StreamEnvelope<unknown>) {
  if (!sessionSubId || p.requestId !== sessionSubId) return;
  if (p.kind === "progress") {
    if (selectedSessionId) void refreshSessionDetail(selectedSessionId);
  } else if (p.kind === "error" || p.kind === "done") {
    // The server closed the stream (session deleted server-side, or the
    // subscription window ended). A new selection re-subscribes.
    sessionSubId = null;
  }
}

/** Provider A/B: each provider's streamed answer plus its score, latency
    and cost; the final event names the winner. */
function handleAbtestEvent(p: StreamEnvelope<AbTestEvent>) {
  if (!abtestState || p.requestId !== abtestState.requestId) return;
  if (p.kind === "progress" && p.event) {
    const e = p.event;
    const name = e.provider_name ?? "provider";
    const entry = abtestState.per.get(name) ?? { text: "", finished: false };
    if (e.content_chunk) entry.text += e.content_chunk;
    if (e.finished) {
      entry.finished = true;
      if (typeof e.score === "number") entry.score = e.score;
      if (typeof e.latency_ms === "number") entry.latencyMs = e.latency_ms;
      if (typeof e.cost_usd === "number") entry.costUsd = e.cost_usd;
    }
    abtestState.per.set(name, entry);
    if (e.winner) abtestState.winner = e.winner;
    renderAbtest();
  } else if (p.kind === "done") {
    renderAbtest();
  } else if (p.kind === "error") {
    abtestState.error = p.error ?? "stream failed";
    renderAbtest();
  } else if (p.kind === "cancelled") {
    abtestState = null;
    renderAbtest();
  }
}

function renderAbtest() {
  const body = document.querySelector<HTMLElement>("#abtest-body");
  if (!body) return;
  body.replaceChildren();
  if (!abtestState) return;
  if (abtestState.error) {
    body.append(Object.assign(document.createElement("p"), { className: "field-error", textContent: `A/B test failed: ${abtestState.error}` }));
  }
  for (const [name, entry] of abtestState.per) {
    const row = document.createElement("div");
    row.className = "abtest-provider";
    const head = document.createElement("strong");
    head.textContent = `${name}${abtestState.winner === name ? " ★ winner" : ""}`;
    const meta = document.createElement("span");
    const parts: string[] = [];
    if (typeof entry.score === "number") parts.push(`score ${entry.score.toFixed(2)}`);
    if (typeof entry.latencyMs === "number") parts.push(`${Math.round(entry.latencyMs)} ms`);
    if (typeof entry.costUsd === "number") parts.push(`$${entry.costUsd.toFixed(4)}`);
    if (entry.finished) parts.push("done");
    else parts.push("…");
    meta.textContent = parts.join(" · ");
    const text = document.createElement("p");
    text.className = "abtest-text";
    text.textContent = entry.text.slice(-400) || "no text yet";
    row.append(head, meta, text);
    body.append(row);
  }
}

function openAbtestDialog() {
  const dialog = $("#abtest-dialog") as HTMLDialogElement;
  ($("#abtest-prompt") as HTMLTextAreaElement).value = "";
  ($("#abtest-error") as HTMLElement).hidden = true;
  const mode = $("#abtest-mode") as HTMLSelectElement;
  mode.innerHTML = "";
  for (const [value, label] of [
    ["SIDE_BY_SIDE", "Side by side (all providers at once)"],
    ["SEQUENTIAL_SCORED", "Sequential, judge-scored"],
    ["SHADOW", "Shadow (primary answers, others run silently)"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    mode.append(opt);
  }
  const box = $("#abtest-providers") as HTMLElement;
  box.replaceChildren();
  for (const p of providers) {
    const label = document.createElement("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = p.name;
    label.append(check, document.createTextNode(` ${p.name}`));
    box.append(label);
  }
  renderAbtest();
  dialog.showModal();
}

async function startAbtest() {
  const prompt = ($("#abtest-prompt") as HTMLTextAreaElement).value.trim();
  if (!prompt) return;
  const names = [...document.querySelectorAll<HTMLInputElement>("#abtest-providers input:checked")].map((c) => c.value);
  const mode = ($("#abtest-mode") as HTMLSelectElement).value;
  const requestId = `ab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  abtestState = { requestId, per: new Map(), winner: undefined };
  renderAbtest();
  try {
    await providerAbtest(requestId, prompt, names.length ? names : undefined, mode);
  } catch (err) {
    abtestState.error = err instanceof Error ? err.message : String(err);
    renderAbtest();
  }
}

/** Workflow schedules: list, create (cron), pause/resume, trigger, delete —
    all HTTP-bound, so no transport decision is needed. */
async function refreshSchedules() {
  try {
    workflowSchedules = await listWorkflowSchedules();
    schedulesLoadError = null;
  } catch (err) {
    workflowSchedules = [];
    schedulesLoadError = err instanceof Error ? err.message : String(err);
  }
  renderSchedules();
}

function scheduleRow(raw: unknown): {
  id: string; workflow: string; cron: string; timezone: string; enabled: boolean;
} {
  const s = raw as {
    schedule_id?: string; id?: string; workflow_name?: string; name?: string;
    schedule?: { cron?: string; timezone?: string; enabled?: boolean };
    cron?: string; timezone?: string; enabled?: boolean;
  };
  return {
    id: s.schedule_id ?? s.id ?? "?",
    workflow: s.workflow_name ?? s.name ?? "?",
    cron: s.schedule?.cron ?? s.cron ?? "?",
    timezone: s.schedule?.timezone ?? s.timezone ?? "UTC",
    enabled: s.schedule?.enabled ?? s.enabled ?? true,
  };
}

function renderSchedules() {
  const list = document.querySelector<HTMLElement>("#schedules-list");
  if (!list) return;
  list.replaceChildren();
  if (schedulesLoadError) {
    list.append(Object.assign(document.createElement("p"), { className: "field-error", textContent: `Could not list schedules: ${schedulesLoadError}` }));
  } else if (workflowSchedules.length === 0) {
    list.append(Object.assign(document.createElement("p"), { className: "empty", textContent: "No scheduled workflows." }));
  }
  for (const raw of workflowSchedules) {
    const s = scheduleRow(raw);
    const row = document.createElement("div");
    row.className = "schedule-row";
    const info = document.createElement("span");
    info.textContent = `${s.workflow} · ${s.cron} · ${s.timezone}${s.enabled ? "" : " · paused"}`;
    const actions = document.createElement("span");
    actions.className = "schedule-actions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn ghost small";
    toggle.textContent = s.enabled ? "Pause" : "Resume";
    toggle.addEventListener("click", async () => {
      try {
        await updateWorkflowSchedule(s.id, undefined, undefined, !s.enabled);
        await refreshSchedules();
      } catch (err) {
        schedulesLoadError = err instanceof Error ? err.message : String(err);
        renderSchedules();
      }
    });
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "btn ghost small";
    trigger.textContent = "Run now";
    trigger.addEventListener("click", async () => {
      try {
        await triggerWorkflowSchedule(s.id);
        await refreshExecutionsList();
        agentsNotice(`Triggered ${s.workflow}.`, false);
      } catch (err) {
        agentsNotice(`Could not trigger: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn ghost small danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!window.confirm(`Delete the schedule for ${s.workflow}?`)) return;
      try {
        await deleteWorkflowSchedule(s.id);
        await refreshSchedules();
      } catch (err) {
        schedulesLoadError = err instanceof Error ? err.message : String(err);
        renderSchedules();
      }
    });
    const history = document.createElement("button");
    history.type = "button";
    history.className = "btn ghost small";
    history.textContent = "History";
    history.addEventListener("click", async () => {
      const dialog = $("#knowledge-dialog") as HTMLDialogElement;
      dialog.replaceChildren();
      const h2 = document.createElement("h2");
      h2.textContent = `Schedule history — ${s.workflow}`;
      dialog.append(h2);
      const body = document.createElement("div");
      body.className = "mcp-tools";
      body.append(Object.assign(document.createElement("p"), { textContent: "Loading history…" }));
      dialog.append(body);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "btn ghost";
      close.textContent = "Close";
      close.addEventListener("click", () => dialog.close());
      dialog.append(close);
      dialog.showModal();
      try {
        const entries = await workflowScheduleHistory(s.id);
        body.replaceChildren();
        if (entries.length === 0) {
          body.append(Object.assign(document.createElement("p"), { textContent: "No runs recorded for this schedule." }));
        }
        for (const e of entries) {
          const run = e as { execution_id?: string; started_at?: number; completed_at?: number; status?: string };
          const row = document.createElement("div");
          row.className = "mcp-tool";
          const when = run.started_at ? new Date(run.started_at * 1000).toLocaleString() : "—";
          row.append(Object.assign(document.createElement("strong"), {
            textContent: `${run.status ?? "run"} · ${when}`,
          }));
          if (run.execution_id) row.append(Object.assign(document.createElement("p"), { textContent: run.execution_id }));
          body.append(row);
        }
      } catch (err) {
        body.replaceChildren();
        body.append(Object.assign(document.createElement("p"), {
          textContent: `Could not load the history: ${err instanceof Error ? err.message : String(err)}`,
        }));
      }
    });
    actions.append(toggle, trigger, history, del);
    row.append(info, actions);
    list.append(row);
  }
}

function openScheduleDialog() {
  const dialog = $("#schedule-dialog") as HTMLDialogElement;
  const sel = $("#schedule-workflow") as HTMLSelectElement;
  sel.innerHTML = "";
  for (const wf of workflows) {
    const opt = document.createElement("option");
    opt.value = wf.name;
    opt.textContent = wf.name;
    sel.append(opt);
  }
  ($("#schedule-cron") as HTMLInputElement).value = "0 */6 * * *";
  ($("#schedule-timezone") as HTMLInputElement).value = "UTC";
  ($("#schedule-error") as HTMLElement).hidden = true;
  dialog.showModal();
}

async function submitSchedule() {
  const name = ($("#schedule-workflow") as HTMLSelectElement).value;
  const cron = ($("#schedule-cron") as HTMLInputElement).value.trim();
  const timezone = ($("#schedule-timezone") as HTMLInputElement).value.trim();
  if (!name || !cron) return;
  try {
    await createWorkflowSchedule(name, cron, timezone || undefined, true);
    ($("#schedule-dialog") as HTMLDialogElement).close();
    await refreshSchedules();
  } catch (err) {
    const el = $("#schedule-error") as HTMLElement;
    el.textContent = err instanceof Error ? err.message : String(err);
    el.hidden = false;
  }
}

// ---------------------------------------------------------------------------
// Artifacts (real Loom server, attach to work item)
// ---------------------------------------------------------------------------

function buildArtifactsSection(item: WorkItem): HTMLElement {  const section = document.createElement("section");
  section.className = "wd-section";
  const head = document.createElement("div");
  head.className = "wd-section-head";
  const h = document.createElement("h4");
  h.textContent = "Artifacts";
  const actions = document.createElement("div");
  actions.className = "section-actions";
  const browse = document.createElement("button");
  browse.type = "button";
  browse.className = "quiet-btn";
  browse.textContent = "Browse workspace";
  browse.title = "Open the workspace artifact list";
  browse.addEventListener("click", () => setMode("artifacts"));
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "icon-btn small";
  refresh.title = "Refresh artifacts";
  refresh.setAttribute("aria-label", "Refresh artifacts");
  refresh.textContent = "↻";
  refresh.addEventListener("click", () => refreshArtifacts());
  actions.append(browse, refresh);
  head.append(h, actions);
  section.append(head);

  if (workArtifactsError) {
    const error = document.createElement("p");
    error.className = "field-error inline-error";
    error.textContent = workArtifactsError;
    section.append(error);
  }

  if (!loomStatusKnown) {
    section.append(emptyP("Checking the Loom server…"));
    return section;
  }
  if (!loomReachable) {
    section.append(emptyP("The Loom server is offline. Artifacts are not available."));
    return section;
  }

  const attached = new Set(item.artifact_ids ?? []);
  // Show the work's session artifacts plus anything explicitly attached
  // from the workspace list, without duplicating rows.
  const visible = [...workArtifacts];
  for (const id of attached) {
    const artifact = artifacts.find((a) => a.id === id);
    if (artifact && !visible.some((a) => a.id === artifact.id)) visible.push(artifact);
  }
  if (visible.length === 0) {
    section.append(
      emptyP(
        item.session_id
          ? "No artifacts for this work yet."
          : "No artifacts linked. This work has no Loom session yet; artifacts from a session appear here when one is linked.",
      ),
    );
    return section;
  }

  const ul = document.createElement("ul");
  ul.className = "artifact-list";
  for (const a of visible) {
    const li = document.createElement("li");
    const info = document.createElement("div");
    info.className = "artifact-info";
    const name = document.createElement("strong");
    name.textContent = a.name;
    info.append(name);
    const meta = [a.source, a.purpose].filter(Boolean).join(" · ");
    if (meta) {
      const span = document.createElement("span");
      span.textContent = meta;
      info.append(span);
    }
    const isAttached = attached.has(a.id);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn" + (isAttached ? "" : " ghost");
    toggle.textContent = isAttached ? "Detach" : "Attach";
    toggle.addEventListener("click", () => {
      toggle.disabled = true;
      void toggleArtifact(item, a.id, isAttached);
    });
    li.append(info, toggle);
    ul.append(li);
  }
  section.append(ul);
  if (workArtifacts.length === ARTIFACTS_LIMIT) {
    const note = document.createElement("p");
    note.className = "wd-sub-label";
    note.textContent =
      "Showing 200 artifacts for this session — there may be more.";
    section.append(note);
  }
  return section;
}

/** Load the selected work's artifacts ("what this work produced"): only
    artifacts from its Loom session. With no session the section says so
    rather than presenting the workspace list as if this work produced it. */
async function loadWorkArtifacts(workId: string) {
  const item = workItems.find((w) => w.id === workId);
  if (!item) return;
  workArtifactsError = null;
  if (!item.session_id) {
    workArtifacts = [];
    renderWorkDetail();
    return;
  }
  try {
    const list = await listArtifacts(item.session_id);
    if (selectedWorkId !== workId) return;
    workArtifacts = list;
    setLoomReachable(true);
    renderWorkDetail();
  } catch (err) {
    if (selectedWorkId !== workId) return;
    if (isLoomConnectionError(err)) setLoomReachable(false);
    workArtifacts = [];
    workArtifactsError = `Could not load this work's artifacts: ${err instanceof Error ? err.message : String(err)}`;
    renderWorkDetail();
  }
}

async function refreshArtifacts() {
  workArtifactsError = null;
  try {
    artifacts = await listArtifacts();
    setLoomReachable(true);
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    artifacts = [];
    workArtifactsError = `Could not refresh workspace artifacts: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (selectedWorkId) await loadWorkArtifacts(selectedWorkId);
  renderWorkDetail();
  renderArtifacts();
}

/** In-flight artifact toggles, per artifact id: two quick toggles would
    otherwise read the same stale snapshot and the second would undo the
    first. */
const artifactSaving = new Set<string>();

async function toggleArtifact(item: WorkItem, artifactId: string, currentlyAttached: boolean) {
  if (artifactSaving.has(artifactId)) return;
  artifactSaving.add(artifactId);
  workArtifactsError = null;
  const ids = new Set(item.artifact_ids ?? []);
  if (currentlyAttached) ids.delete(artifactId);
  else ids.add(artifactId);
  try {
    const updated = await setWorkArtifacts(item.id, [...ids]);
    workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
    renderWorkDetail();
    renderArtifacts();
  } catch (err) {
    workArtifactsError = `Could not update artifacts: ${err instanceof Error ? err.message : String(err)}`;
    renderWorkDetail();
  } finally {
    artifactSaving.delete(artifactId);
  }
}

// ---- Evidence (experiment decisions + workflow results; workspace-wide) ----

/** The run's actual output, preferring the merged output over per-agent
    outputs. Null when the result carries no readable output. */
function workflowResultText(result: WorkflowResult | null | undefined): string | null {
  if (!result) return null;
  if (result.merged_output?.trim()) return result.merged_output.trim();
  const outs = (result.agent_results ?? [])
    .map((r) => r.output?.trim())
    .filter((o): o is string => Boolean(o));
  if (outs.length > 0) return outs.join("\n\n");
  return null;
}

interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  title: string;
  detail: string;
  kindLabel: string;
}

/** Everything the Evidence surfaces draw on: decided experiments plus the
    recorded output of workflow runs. Workspace-wide — experiments and
    executions are not attributed to a work item.

    Every item carries a provenance kind so claims are never mistaken
    for ground truth (P3 Human Understanding):
    - experiment decisions are "recorded" (a human stored this choice)
    - workflow results are "observed" (the server produced this output) */
function evidenceItems(workId?: string): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const e of experiments.filter((x) => x.decision)) {
    if (workId && experimentWorkIds.get(e.id) !== workId) continue;
    const arm = e.arms.find((a) => a.id === e.decision);
    items.push({
      id: `decision-${e.id}`,
      kind: "recorded",
      kindLabel: evidenceKindLabel("recorded"),
      title: e.title,
      detail: `Chose ${arm?.label ?? e.decision}`,
    });
  }
  for (const ex of executions) {
    if (workId && executionWorkIds.get(ex.id) !== workId) continue;
    const text = workflowResultText(ex.result);
    if (!text) continue;
    const name =
      executionWorkflowNames.get(ex.id) ?? ex.result?.pattern_type ?? "Workflow";
    const detail = text.length > 400 ? `${text.slice(0, 400)}…` : text;
    items.push({
      id: `execution-${ex.id}`,
      kind: "observed",
      kindLabel: evidenceKindLabel("observed"),
      title: `${name} — ${ex.status}`,
      detail,
    });
  }
  return items;
}

function buildEvidenceSection(workId?: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const head = document.createElement("div");
  head.className = "wd-section-head";
  const h = document.createElement("h4");
  h.textContent = "Evidence";
  const browse = document.createElement("button");
  browse.type = "button";
  browse.className = "quiet-btn";
  browse.textContent = "Open Evidence";
  browse.title = "Open workspace evidence";
  browse.addEventListener("click", () => setMode("evidence"));
  head.append(h, browse);
  section.append(head);

  const items = evidenceItems(workId);
  if (items.length === 0) {
    section.append(
      emptyP(
        workId
          ? "No evidence is linked to this work yet. Decisions and workflow results started from this work appear here; workspace-wide evidence lives in Evidence."
          : "No findings yet. Experiment decisions and workflow results appear here as evidence once made.",
      ),
    );
    return section;
  }
  const ul = document.createElement("ul");
  ul.className = "evidence-list";
  for (const item of items) {
    const li = document.createElement("li");
    const headRow = document.createElement("div");
    headRow.className = "ev-head";
    const title = document.createElement("strong");
    title.textContent = item.title;
    headRow.append(title);
    const kind = document.createElement("span");
    kind.className = "ev-kind";
    kind.textContent = item.kindLabel;
    kind.title = `${item.kindLabel} evidence — what this claim rests on.`;
    headRow.append(kind);
    const detail = document.createElement("p");
    detail.className = "ev-detail";
    detail.textContent = item.detail;
    li.append(headRow, detail);
    ul.append(li);
  }
  section.append(ul);
  return section;
}

// D9: every empty state is one line stating what is missing plus the next
// step. The next step names an existing control; never a second creation
// button (see D1/D2). Offline states all use "The Loom server is offline."
function emptyP(text: string): HTMLElement {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

// ---------------------------------------------------------------------------
// Inspector: local attention and connected server details
// ---------------------------------------------------------------------------

function renderInspectorContext() {
  renderAttention(attentionItems);
  renderInspectorSessionDetail();
  renderInspectorAgentDetail();
  renderInspectorTools();
  renderInspectorModels();
  renderInspectorProviders();
  renderInspectorArtifactStats();
  renderInspectorServerConfig();
  renderInspectorStorageStatus();
}

function renderInspectorSessionDetail() {
  const section = document.getElementById("inspector-session-detail");
  if (!section) return;
  if (!sessionDetail) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  section.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "inspector-section-title";
  h.textContent = `Session: ${sessionDetail.name || sessionDetail.id}`;
  section.append(h);
  section.append(renderSessionDetail());
}

function renderInspectorAgentDetail() {
  const section = document.getElementById("inspector-agent-detail");
  if (!section) return;
  if (!selectedAgentDetail) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  section.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "inspector-section-title";
  h.textContent = `Agent: ${selectedAgentDetail.name}`;
  section.append(h);
  section.append(renderAgentDetail());
}

function renderInspectorTools() {
  const section = document.getElementById("inspector-tools");
  const content = document.getElementById("inspector-tools-content");
  if (!section || !content) return;
  if (tools.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "tool-list";
  for (const t of tools) {
    const li = document.createElement("li");
    li.className = "flat-row";
    const name = document.createElement("strong");
    name.textContent = t.name;
    const cat = document.createElement("span");
    cat.className = "tool-category";
    cat.textContent = t.category || "(uncategorized)";
    const desc = document.createElement("p");
    desc.className = "tool-desc";
    desc.textContent = t.description || "(no description)";
    li.append(name, cat, desc);
    ul.append(li);
  }
  content.append(ul);
}

function renderInspectorModels() {
  const section = document.getElementById("inspector-models");
  const content = document.getElementById("inspector-models-content");
  if (!section || !content) return;
  if (models.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "model-list";
  for (const m of models) {
    const li = document.createElement("li");
    li.className = "flat-row";
    const name = document.createElement("strong");
    name.textContent = m.name;
    const provider = document.createElement("span");
    provider.className = "model-provider";
    provider.textContent = m.provider;
    li.append(name, provider);
    ul.append(li);
  }
  content.append(ul);
}

function renderInspectorProviders() {
  const section = document.getElementById("inspector-providers");
  const content = document.getElementById("inspector-providers-content");
  if (!section || !content) return;
  if (providers.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "provider-list";
  for (const p of providers) {
    const li = document.createElement("li");
    li.className = "flat-row";
    const name = document.createElement("strong");
    name.textContent = p.name;
    const model = document.createElement("span");
    model.textContent = [p.config.provider, p.config.model].filter(Boolean).join(" · ");
    const active = document.createElement("span");
    active.className = p.active ? "provider-active" : "provider-inactive";
    active.textContent = p.active ? "active" : "inactive";
    li.append(name, model, active);
    ul.append(li);
  }
  content.append(ul);
}

function renderInspectorArtifactStats() {
  const section = document.getElementById("inspector-artifact-stats");
  const content = document.getElementById("inspector-artifact-stats-content");
  if (!section || !content) return;
  if (!artifactStats) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const dl = document.createElement("dl");
  dl.className = "stats-list";
  const rows = [
    ["Total files", String(artifactStats.total_files)],
    ["Total size", formatBytes(artifactStats.total_size_bytes)],
    ["User files", String(artifactStats.user_files)],
    ["Generated files", String(artifactStats.generated_files)],
    ["Deleted files", String(artifactStats.deleted_files)],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  content.append(dl);
}

function renderInspectorServerConfig() {
  const section = document.getElementById("inspector-server-config");
  const content = document.getElementById("inspector-server-config-content");
  if (!section || !content) return;
  if (!serverConfig) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const dl = document.createElement("dl");
  dl.className = "config-list";
  const rows: [string, string][] = [];
  const enabled = (value: boolean) => value ? "Enabled" : "Disabled";
  if (serverConfig.name) rows.push(["Name", serverConfig.name]);
  if (serverConfig.network) {
    const network = serverConfig.network;
    if (network.grpc_address) rows.push(["gRPC address", network.grpc_address]);
    if (network.http_address) rows.push(["HTTP address", network.http_address]);
    rows.push(["HTTP gateway", enabled(network.http_enabled)]);
    rows.push(["gRPC reflection", enabled(network.reflection_enabled)]);
  }
  if (serverConfig.tls) {
    rows.push(["TLS", enabled(serverConfig.tls.enabled)]);
    if (serverConfig.tls.mode) rows.push(["TLS mode", serverConfig.tls.mode]);
  }
  if (serverConfig.behavior) {
    const behavior = serverConfig.behavior;
    rows.push(["Max concurrent requests", String(behavior.max_concurrent_requests)]);
    rows.push(["Request timeout (s)", String(behavior.request_timeout_seconds)]);
    rows.push(["Graceful shutdown", enabled(behavior.graceful_shutdown)]);
    rows.push(["Shutdown timeout (s)", String(behavior.shutdown_timeout_seconds)]);
    rows.push(["CORS", enabled(behavior.cors_enabled)]);
    if (behavior.cors_allowed_origins.length) {
      rows.push(["CORS allowed origins", behavior.cors_allowed_origins.join(", ")]);
    }
  }
  if (serverConfig.storage?.backend) rows.push(["Storage backend", serverConfig.storage.backend]);
  for (const [key, value] of Object.entries(serverConfig.metadata)) {
    rows.push([`Metadata: ${key}`, value]);
  }
  section.hidden = rows.length === 0;
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  }
  content.append(dl);
}

function renderInspectorStorageStatus() {
  const section = document.getElementById("inspector-storage-status");
  const content = document.getElementById("inspector-storage-status-content");
  if (!section || !content) return;
  if (!storageStatus) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const status = document.createElement("div");
  status.className = `status-indicator ${storageStatus.healthy ? "healthy" : "unhealthy"}`;
  status.textContent = storageStatus.healthy ? "Healthy" : "Unhealthy";
  const backend = document.createElement("p");
  backend.textContent = `Backend: ${storageStatus.backend}`;
  const detail = document.createElement("p");
  detail.textContent = storageStatus.error;
  detail.hidden = !storageStatus.error;
  const latency = document.createElement("p");
  latency.textContent = `Health check latency: ${storageStatus.latency_ms} ms`;
  content.append(status, backend, latency, detail);
}

function renderAttention(items: AttentionItem[]) {
  const list = $("#attention-list");
  list.innerHTML = "";
  $("#att-count").textContent = String(items.length);
  const contextTab = document.getElementById("tab-context");
  if (contextTab) {
    contextTab.title =
      items.length === 0
        ? "Collaboration and attention"
        : `${items.length} item${items.length === 1 ? "" : "s"} need attention`;
    contextTab.classList.toggle("has-attention", items.length > 0);
  }
  $("#chat-toggle").classList.toggle("has-attention", items.length > 0);
  const dot = $(".att-dot");
  if (dot) dot.classList.toggle("live", items.length > 0);

  if (items.length === 0) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "step-label attention-empty";
    span.textContent = "Nothing needs a decision.";
    li.append(span);
    list.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "att-item";
    const ico = document.createElement("span");
    ico.className = "att-ico" + (item.kind === "finding" ? " finding" : "");
    ico.textContent = item.kind === "finding" ? "↗" : "!";
    const text = document.createElement("span");
    text.className = "att-text";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.textContent = item.detail;
    text.append(title, detail);
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "›";
    row.append(ico, text, chev);
    row.addEventListener("click", () => openAttentionDialog(item, row));
    li.append(row);
    list.append(li);
  }
}

let attentionDialog: HTMLElement | null = null;
let attentionDialogReturn: HTMLElement | null = null;

/** Inspect a decision (or finding) without leaving the work surface. Real
    decisions expose the experiment's question, hypothesis, and arm results
    and can be recorded here. */
function openAttentionDialog(item: AttentionItem, opener?: HTMLElement) {
  closeAttentionDialog(false);
  attentionDialogReturn = opener ?? (document.activeElement as HTMLElement | null);
  const expId = item.id.startsWith("decision-")
    ? item.id.slice("decision-".length)
    : null;
  const exp = expId ? experiments.find((e) => e.id === expId) : undefined;

  const overlay = document.createElement("div");
  overlay.className = "decision-overlay";
  overlay.id = "decision-dialog-overlay";
  const dialog = document.createElement("div");
  dialog.className = "decision-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "decision-dialog-title");

  const head = document.createElement("div");
  head.className = "decision-head";
  const title = document.createElement("h3");
  title.id = "decision-dialog-title";
  title.textContent = exp ? exp.title : item.title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-btn small";
  close.setAttribute("aria-label", "Close decision detail");
  close.textContent = "✕";
  close.addEventListener("click", () => closeAttentionDialog());
  head.append(title, close);
  dialog.append(head);

  const provenance = document.createElement("p");
  provenance.className = "decision-provenance";
  provenance.textContent = exp
    ? "Decision recorded by you from real experiment results."
    : "This item comes from the Loom server.";
  dialog.append(provenance);

  if (exp) {
    const question = document.createElement("p");
    question.className = "decision-field";
    question.innerHTML = `<span>Question</span>${escapeHtml(exp.question || "Not stated yet.")}`;
    const hypothesis = document.createElement("p");
    hypothesis.className = "decision-field";
    hypothesis.innerHTML = `<span>Hypothesis</span>${escapeHtml(exp.hypothesis || "Not stated yet.")}`;
    dialog.append(question, hypothesis);

    const armsLabel = document.createElement("h4");
    armsLabel.textContent = "Arm results";
    dialog.append(armsLabel);
    const arms = document.createElement("ul");
    arms.className = "decision-arms";
    for (const arm of exp.arms) {
      const li = document.createElement("li");
      const armName = document.createElement("strong");
      armName.textContent = arm.label;
      const status = document.createElement("span");
      status.className = `exp-status ${arm.status}`;
      status.textContent = arm.status;
      const config = document.createElement("p");
      config.className = "decision-arm-config";
      config.textContent = arm.config || "No configuration recorded.";
      li.append(armName, status, config);
      if (arm.result.trim()) {
        const result = document.createElement("pre");
        result.className = "decision-arm-result";
        result.textContent =
          arm.result.length > 600 ? `${arm.result.slice(0, 600)}…` : arm.result;
        li.append(result);
      }
      arms.append(li);
    }
    dialog.append(arms);

    if (exp.decision) {
      const chosen = exp.arms.find((a) => a.id === exp.decision);
      const decided = document.createElement("p");
      decided.className = "decision-recorded";
      decided.textContent = `Chosen: ${chosen?.label ?? exp.decision}`;
      dialog.append(decided);
    } else {
      const doneArms = exp.arms.filter((a) => a.status === "done");
      if (doneArms.length >= 2) {
        const chooseLabel = document.createElement("p");
        chooseLabel.className = "decision-choose-label";
        chooseLabel.textContent = "Choose the configuration to carry forward:";
        const options = document.createElement("div");
        options.className = "exp-decision-options";
        for (const arm of doneArms) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn";
          btn.textContent = `Choose ${arm.label}`;
          btn.addEventListener("click", async () => {
            clearFieldError(error);
            btn.disabled = true;
            try {
              const updated = await chooseExperimentArm(exp.id, arm.id);
              replaceExperiment(updated);
              renderExperiments();
              await refreshAttention();
              closeAttentionDialog();
            } catch (err) {
              btn.disabled = false;
              showFieldError(
                error,
                `Could not record the decision: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          });
          options.append(btn);
        }
        dialog.append(chooseLabel, options);
      } else {
        const waiting = document.createElement("p");
        waiting.className = "empty";
        waiting.textContent =
          "This decision opens when at least two arms have finished.";
        dialog.append(waiting);
      }
    }

    const error = document.createElement("p");
    error.className = "field-error decision-error";
    error.hidden = true;
    dialog.append(error);

    const actions = document.createElement("div");
    actions.className = "decision-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn ghost";
    open.textContent = "Open in Experiment";
    open.addEventListener("click", () => {
      closeAttentionDialog(false);
      selectExperiment(exp.id);
      setMode("experiment");
    });
    actions.append(open);
    if (exp.decision) {
      const change = document.createElement("button");
      change.type = "button";
      change.className = "btn ghost";
      change.textContent = "Change decision";
      change.addEventListener("click", async () => {
        clearFieldError(error);
        change.disabled = true;
        try {
          const updated = await clearExperimentDecision(exp.id);
          replaceExperiment(updated);
          renderExperiments();
          await refreshAttention();
          closeAttentionDialog();
        } catch (err) {
          change.disabled = false;
          showFieldError(
            error,
            `Could not change the decision: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
      actions.append(change);
    }
    dialog.append(actions);
  } else {
    const detail = document.createElement("p");
    detail.className = "decision-detail";
    detail.textContent = item.detail;
    dialog.append(detail);
  }

  overlay.append(dialog);
  document.body.append(overlay);
  attentionDialog = overlay;
  close.focus();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAttentionDialog();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Close only the dialog. Without stopping propagation, the document
      // handler would then also close the context drawer behind it.
      e.preventDefault();
      e.stopPropagation();
      closeAttentionDialog();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

function closeAttentionDialog(returnFocus = true) {
  attentionDialog?.remove();
  attentionDialog = null;
  if (returnFocus && attentionDialogReturn?.isConnected) {
    attentionDialogReturn.focus();
  }
  attentionDialogReturn = null;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Reload the attention list from the backend (experiments waiting for a
    decision are real attention items) and re-render the panel. */
async function refreshAttention() {
  try {
    attentionItems = await getAttention();
  } catch {
    attentionItems = [];
  }
  renderAttention(attentionItems);
  renderStatusPill();
}

// ---------------------------------------------------------------------------
// One contextual surface: Context + Conversation tabs in the right pane.
// At wide widths it is a collapsible column; below that it is the same pane
// as a drawer. Opening Conversation never leaves a second chat crowding the
// work surface.
// ---------------------------------------------------------------------------

let rightTab: RightTab = "conversation";
let rightOpen = window.matchMedia("(min-width: 1100px)").matches;
let rightWasDrawer = isRightDrawer();
let spatialPane: { tab: RightTab; open: boolean } = { tab: rightTab, open: rightOpen };
let otherPane: { tab: RightTab; open: boolean } = { tab: "context", open: window.matchMedia("(min-width: 1440px)").matches };
let knowledgeOpener: HTMLElement | null = null;

function isRightDrawer(): boolean {
  return !window.matchMedia(mode === "spatial" ? "(min-width: 1100px)" : "(min-width: 1440px)").matches;
}

function isLeftDrawer(): boolean {
  return !window.matchMedia("(min-width: 1100px)").matches;
}


function updateScrim() {
  const open =
    document.body.classList.contains("knowledge-open") ||
    document.body.classList.contains("left-open") ||
    (isRightDrawer() && document.body.classList.contains("right-open"));
  $("#scrim").hidden = !open;
}

function closeKnowledgeDrawer(returnFocus = true) {
  document.body.classList.remove("knowledge-open");
  $("#spatial-knowledge-toggle").setAttribute("aria-expanded", "false");
  updateScrim();
  if (returnFocus) knowledgeOpener?.focus();
  knowledgeOpener = null;
}

function applyRightPane() {
  document.body.classList.toggle("right-open", rightOpen && isRightDrawer());
  document.body.classList.toggle("right-hidden", !rightOpen);
  const contextPane = document.getElementById("inspector-context");
  const chatPane = document.getElementById("chat-panel");
  if (contextPane) contextPane.hidden = rightTab !== "context";
  if (chatPane) chatPane.hidden = rightTab !== "conversation";

  const contextTab = document.getElementById("tab-context");
  const chatTab = document.getElementById("tab-conversation");
  contextTab?.classList.toggle("active", rightTab === "context");
  chatTab?.classList.toggle("active", rightTab === "conversation");
  contextTab?.setAttribute("aria-selected", String(rightTab === "context"));
  chatTab?.setAttribute("aria-selected", String(rightTab === "conversation"));

  const chatToggle = document.getElementById("chat-toggle");
  chatToggle?.classList.toggle("active", rightOpen && rightTab === "conversation");
  chatToggle?.setAttribute("aria-expanded", String(rightOpen));
  updateScrim();
}

/** Open the right pane on a tab. At drawer widths this is the only pane
    that opens, and focus moves into it; the chat log and draft stay put
    when it closes. */
function openRight(tab: RightTab, opener?: HTMLElement) {
  closeKnowledgeDrawer(false);
  // One contextual surface at a time: opening the right drawer closes the
  // work catalogue drawer rather than stacking two modal panes.
  if (document.body.classList.contains("left-open")) closeLeftDrawer(false);
  if (opener && isRightDrawer()) lastFocus = opener;
  rightTab = tab;
  rightOpen = true;
  applyRightPane();
  if (tab === "conversation" && rightOpen) {
    loadChatForWork(selectedWorkId, selectedSessionId);
  }
  if (isRightDrawer()) {
    const target =
      tab === "conversation"
        ? ($("#chat-text") as HTMLInputElement)
        : (($("#tab-context") as HTMLButtonElement) ?? null);
    target?.focus();
  }
}

function closeRight(returnFocus = true) {
  rightOpen = false;
  applyRightPane();
  if (returnFocus && isRightDrawer() && lastFocus) {
    lastFocus.focus();
  }
  lastFocus = null;
}

function selectRightTab(tab: RightTab) {
  rightTab = tab;
  rightOpen = true;
  applyRightPane();
  if (tab === "conversation") {
    loadChatForWork(selectedWorkId, selectedSessionId);
  }
}

/** The Conversation control: opens the shared pane on its conversation tab
    and puts the cursor in the message box. Nothing about the conversation
    is created, cleared, or reset by opening or closing it. */
function focusChat(from?: HTMLElement) {
  openRight("conversation", from);
  ($("#chat-text") as HTMLInputElement).focus();
}

function openLeftDrawer(opener?: HTMLElement) {
  if (!isLeftDrawer()) return;
  // Symmetric with openRight: the two drawers never stack.
  if (isRightDrawer() && rightOpen) closeRight(false);
  if (opener) lastFocus = opener;
  document.body.classList.add("left-open");
  updateScrim();
  ($("#left-close") as HTMLButtonElement).focus();
}

function closeLeftDrawer(returnFocus = true) {
  document.body.classList.remove("left-open");
  updateScrim();
  if (returnFocus && lastFocus) {
    lastFocus.focus();
  }
  lastFocus = null;
}

function closeDrawers() {
  if (document.body.classList.contains("knowledge-open")) { closeKnowledgeDrawer(); return; }
  // Only one drawer can be open. Close that one so its opener receives
  // focus, rather than routing the return through the other drawer.
  if (document.body.classList.contains("left-open")) {
    closeLeftDrawer();
    return;
  }
  if (isRightDrawer() && rightOpen) closeRight();
}

// ---------------------------------------------------------------------------
// Agents view — empty until the Loom server exposes live agents
// ---------------------------------------------------------------------------

function agentDetail(a: Agent): string {
  const parts: string[] = [];
  if (a.status === "running" && a.uptime_seconds > 0) {
    const h = Math.floor(a.uptime_seconds / 3600);
    const m = Math.floor((a.uptime_seconds % 3600) / 60);
    parts.push(h > 0 ? `Up ${h}h ${m}m` : `Up ${m}m`);
  }
  if (a.active_sessions > 0) {
    parts.push(
      `${a.active_sessions} active session${a.active_sessions === 1 ? "" : "s"}`,
    );
  }
  parts.push(
    `${a.total_messages} message${a.total_messages === 1 ? "" : "s"} processed`,
  );
  return parts.join(" · ");
}

let mcpServers: McpServer[] = [];
let apps: unknown[] = [];
let agentPresets: unknown[] = [];

function agentsNotice(text: string, isError = false) {
  const note = $("#agents-notice") as HTMLElement;
  note.textContent = text;
  note.classList.toggle("error", isError);
  note.hidden = false;
  window.setTimeout(() => { note.hidden = true; }, 6000);
}

function setAgentsTab(tab: "agents" | "mcp" | "apps") {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("#agents-tabs .tab")) {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  }
  $("#agents-list").hidden = tab !== "agents";
  $("#mcp-list").hidden = tab !== "mcp";
  $("#apps-list").hidden = tab !== "apps";
  if (tab === "mcp") void refreshMcpServers();
  if (tab === "apps") void refreshApps();
}

async function refreshMcpServers() {
  try {
    mcpServers = await listMcpServers();
  } catch (err) {
    mcpServers = [];
    agentsNotice(`Could not list MCP servers: ${err instanceof Error ? err.message : String(err)}`, true);
  }
  renderMcpServers();
}

async function refreshApps() {
  try {
    apps = await listApps();
  } catch (err) {
    apps = [];
    agentsNotice(`Could not list Loom apps: ${err instanceof Error ? err.message : String(err)}`, true);
  }
  renderApps();
}

function agentActions(row: HTMLElement, agent: Agent) {
  const actions = document.createElement("div");
  actions.className = "agent-actions";
  const mk = (label: string, fn: (b: HTMLButtonElement) => void, danger = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ghost small${danger ? " danger" : ""}`;
    b.textContent = label;
    b.addEventListener("click", () => fn(b));
    actions.append(b);
    return b;
  };
  const running = agent.status === "running";
  mk(running ? "Stop" : "Start", async (b) => {
    b.disabled = true;
    try {
      running ? await stopAgent(agent.id) : await startAgent(agent.id);
      agentsNotice(`${agent.name} ${running ? "stopped" : "started"}.`);
      await refreshAgents();
      renderAgents();
    } catch (err) {
      agentsNotice(`Could not ${running ? "stop" : "start"} ${agent.name}: ${err instanceof Error ? err.message : String(err)}`, true);
      b.disabled = false;
    }
  });
  mk("Reload", async (b) => {
    b.disabled = true;
    try {
      await reloadAgent(agent.id);
      agentsNotice(`${agent.name} reloaded.`);
      await refreshAgents();
      renderAgents();
    } catch (err) {
      agentsNotice(`Could not reload ${agent.name}: ${err instanceof Error ? err.message : String(err)}`, true);
      b.disabled = false;
    }
  });
  mk("Delete", async () => {
    if (!window.confirm(`Delete agent ${agent.name} from the Loom server?`)) return;
    try {
      await deleteAgent(agent.id);
      agents = agents.filter((a) => a.id !== agent.id);
      renderAgents();
      renderAgentBar();
      agentsNotice(`${agent.name} deleted.`);
    } catch (err) {
      agentsNotice(`Could not delete ${agent.name}: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }, true);
  row.append(actions);
}

function renderAgents() {
  const list = $("#agents-list");
  list.innerHTML = "";
  if (agents.length === 0) {
    // D9: one line stating what is missing plus the next step.
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const text = document.createElement("p");
    text.textContent = !loomStatusKnown
      ? "Checking the Loom server…"
      : loomReachable
        ? "No agents registered yet. Send a message and the answering agent appears here."
        : "The Loom server is offline. No agents are visible.";
    empty.append(text);
    list.append(empty);
    return;
  }
  for (const a of agents) {
    const row = document.createElement("div");
    row.className = "flat-row agent-row";
    const head = document.createElement("div");
    head.className = "ev-head";
    const dot = document.createElement("span");
    dot.className = `agent-dot ${a.status}`;
    dot.title = a.status;
    const name = document.createElement("strong");
    name.textContent = a.name;
    head.append(dot, name);
    const detail = document.createElement("p");
    detail.className = "agent-detail";
    detail.textContent = agentDetail(a);
    row.append(head, detail);
    agentActions(row, a);
    list.append(row);
  }
}

function renderMcpServers() {
  const list = $("#mcp-list");
  list.innerHTML = "";
  if (mcpServers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const text = document.createElement("p");
    text.textContent = "No MCP servers configured. Add one to give Loom's agents more tools.";
    empty.append(text);
    list.append(empty);
    return;
  }
  for (const s of mcpServers) {
    const row = document.createElement("div");
    row.className = "flat-row mcp-row";
    const head = document.createElement("div");
    head.className = "ev-head";
    const dot = document.createElement("span");
    dot.className = `agent-dot ${s.connected ? "running" : s.status === "error" ? "error" : "stopped"}`;
    dot.title = s.status || (s.connected ? "connected" : "disconnected");
    const name = document.createElement("strong");
    name.textContent = s.name;
    head.append(dot, name);
    const detail = document.createElement("p");
    detail.className = "agent-detail";
    const parts = [s.transport || "transport?", s.status || (s.connected ? "connected" : "not connected")];
    if (s.command) parts.push(s.command);
    if (s.url) parts.push(s.url);
    if (s.error) parts.push(`error: ${s.error}`);
    detail.textContent = parts.join(" · ");
    row.append(head, detail);
    const actions = document.createElement("div");
    actions.className = "agent-actions";
    const toolsBtn = document.createElement("button");
    toolsBtn.type = "button";
    toolsBtn.className = "btn ghost small";
    toolsBtn.textContent = "Tools";
    toolsBtn.addEventListener("click", () => { void openMcpTools(s.name); });
    const restartBtn = document.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "btn ghost small";
    restartBtn.textContent = "Restart";
    restartBtn.addEventListener("click", async () => {
      try {
        await restartMcpServer(s.name);
        agentsNotice(`${s.name} restarted.`);
        await refreshMcpServers();
      } catch (err) {
        agentsNotice(`Could not restart ${s.name}: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn ghost small danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async () => {
      if (!window.confirm(`Delete MCP server ${s.name}?`)) return;
      try {
        await deleteMcpServer(s.name);
        agentsNotice(`${s.name} deleted.`);
        await refreshMcpServers();
      } catch (err) {
        agentsNotice(`Could not delete ${s.name}: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    });
    actions.append(toolsBtn, restartBtn, deleteBtn);
    row.append(actions);
    list.append(row);
  }
}

function renderApps() {
  const list = $("#apps-list");
  list.innerHTML = "";
  if (apps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const text = document.createElement("p");
    text.textContent = "No Loom apps reported. The server serves them at /apps when they exist.";
    empty.append(text);
    list.append(empty);
    return;
  }
  for (const raw of apps) {
    const app = raw as { name?: string; description?: string; url?: string };
    const row = document.createElement("div");
    row.className = "flat-row mcp-row";
    const head = document.createElement("div");
    head.className = "ev-head";
    const name = document.createElement("strong");
    name.textContent = app.name ?? "(unnamed app)";
    head.append(name);
    const detail = document.createElement("p");
    detail.className = "agent-detail";
    detail.textContent = app.description ?? app.url ?? "";
    row.append(head, detail);
    const actions = document.createElement("div");
    actions.className = "agent-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn ghost small";
    open.textContent = "Open";
    open.addEventListener("click", () => {
      const url = `http://localhost:5006/apps/${encodeURIComponent(app.name ?? "")}`;
      window.open(url, "_blank");
    });
    actions.append(open);
    row.append(actions);
    list.append(row);
  }
}

async function openMcpTools(serverName: string) {
  const dialog = $("#knowledge-dialog") as HTMLDialogElement;
  dialog.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = `Tools — ${serverName}`;
  dialog.append(h);
  const body = document.createElement("div");
  body.className = "mcp-tools";
  body.append(Object.assign(document.createElement("p"), { textContent: "Loading tools…" }));
  dialog.append(body);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn ghost";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  dialog.append(close);
  dialog.showModal();
  try {
    const tools = await listMcpServerTools(serverName);
    body.replaceChildren();
    if (tools.length === 0) {
      body.append(Object.assign(document.createElement("p"), { textContent: "This server exposes no tools (or is not connected)." }));
    }
    for (const t of tools) {
      const tool = t as { name?: string; description?: string; input_schema_json?: string; inputSchema?: unknown };
      const row = document.createElement("div");
      row.className = "mcp-tool";
      const name = document.createElement("strong");
      name.textContent = tool.name ?? "(unnamed tool)";
      const desc = document.createElement("p");
      desc.textContent = tool.description ?? "";
      row.append(name, desc);
      const schema = tool.input_schema_json ?? (tool.inputSchema ? JSON.stringify(tool.inputSchema) : "");
      if (schema) {
        const params = document.createElement("details");
        params.className = "mcp-tool-params";
        const summary = document.createElement("summary");
        summary.textContent = "Parameters";
        const pre = document.createElement("pre");
        pre.textContent = typeof schema === "string" ? schema : JSON.stringify(schema);
        params.append(summary, pre);
        row.append(params);
      }
      body.append(row);
    }
  } catch (err) {
    body.replaceChildren();
    body.append(Object.assign(document.createElement("p"), {
      textContent: `Could not list tools: ${err instanceof Error ? err.message : String(err)}`,
    }));
  }
}

function initAgentsView() {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("#agents-tabs .tab")) {
    btn.addEventListener("click", () => setAgentsTab(btn.dataset.tab as "agents" | "mcp" | "apps"));
  }
  $("#agent-create-btn").addEventListener("click", () => { void openAgentCreateDialog(); });
  $("#mcp-add-btn").addEventListener("click", () => {
    const d = $("#mcp-dialog") as HTMLDialogElement;
    ($("#mcp-dialog-error") as HTMLElement).hidden = true;
    d.showModal();
  });
  $("#mcp-health-btn").addEventListener("click", async () => {
    try {
      mcpServers = await healthCheckMcpServers();
      renderMcpServers();
      agentsNotice("Health check complete.");
    } catch (err) {
      agentsNotice(`Health check failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  });
  $("#mcp-cancel").addEventListener("click", () => ($("#mcp-dialog") as HTMLDialogElement).close());
  $("#mcp-submit").addEventListener("click", () => { void submitMcpServer(); });
  $("#mcp-test").addEventListener("click", () => { void testMcpConfig(); });
  $("#agent-create-cancel").addEventListener("click", () => ($("#agent-create-dialog") as HTMLDialogElement).close());
  $("#agent-create-submit").addEventListener("click", () => { void submitAgentCreate(); });
  $("#agent-describe-btn").addEventListener("click", () => { void describeAgent(); });
  $("#trace-close").addEventListener("click", () => ($("#trace-dialog") as HTMLDialogElement).close());
}

function readMcpForm(): { name: string; transport: string; command?: string; url?: string; args?: string[] } {
  const name = ($("#mcp-name") as HTMLInputElement).value.trim();
  const transport = ($("#mcp-transport") as HTMLSelectElement).value;
  const command = ($("#mcp-command") as HTMLInputElement).value.trim();
  const url = ($("#mcp-url") as HTMLInputElement).value.trim();
  const args = ($("#mcp-args") as HTMLInputElement).value.trim().split(/\s+/).filter(Boolean);
  return { name, transport, command: command || undefined, url: url || undefined, args: args.length ? args : undefined };
}

function showMcpDialogError(text: string) {
  const el = $("#mcp-dialog-error") as HTMLElement;
  el.textContent = text;
  el.hidden = false;
}

async function testMcpConfig() {
  const form = readMcpForm();
  if (!form.name) return showMcpDialogError("The server needs a name.");
  showMcpDialogError("");
  try {
    await testMcpServer(form.name, form.transport, form.command, form.args, form.url);
    showMcpDialogError("Connection test passed — save it when ready.");
  } catch (err) {
    showMcpDialogError(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function submitMcpServer() {
  const form = readMcpForm();
  if (!form.name) return showMcpDialogError("The server needs a name.");
  showMcpDialogError("");
  try {
    const server = await addMcpServer(form.name, form.transport, form.command, form.args, form.url, true);
    ($("#mcp-dialog") as HTMLDialogElement).close();
    agentsNotice(`MCP server ${server.name} added.`);
    await refreshMcpServers();
  } catch (err) {
    showMcpDialogError(`Could not add the server: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function openAgentCreateDialog() {
  const dialog = $("#agent-create-dialog") as HTMLDialogElement;
  ($("#agent-create-error") as HTMLElement).hidden = true;
  ($("#agent-describe") as HTMLTextAreaElement).value = "";
  ($("#agent-config") as HTMLTextAreaElement).value = "";
  const preset = $("#agent-preset") as HTMLSelectElement;
  preset.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "No preset";
  preset.append(none);
  dialog.showModal();
  try {
    agentPresets = await listAgentPresets();
  } catch {
    agentPresets = [];
  }
  for (const raw of agentPresets) {
    const p = raw as { name?: string; description?: string };
    const opt = document.createElement("option");
    opt.value = p.name ?? "";
    opt.textContent = p.name ?? "(unnamed preset)";
    preset.append(opt);
  }
  preset.onchange = () => {
    if (!preset.value) return;
    const picked = agentPresets.find((r) => (r as { name?: string }).name === preset.value);
    ($("#agent-config") as HTMLTextAreaElement).value = picked ? JSON.stringify(picked, null, 2) : "";
  };
}

async function describeAgent() {
  const describe = ($("#agent-describe") as HTMLTextAreaElement).value.trim();
  if (!describe) return;
  const err = $("#agent-create-error") as HTMLElement;
  err.textContent = "The Weaver is building the config…";
  err.hidden = false;
  try {
    const prompt = [
      "You are the Weaver meta-agent. Produce a Loom agent configuration as a single JSON object",
      "for this description. Include at minimum: name, description, model, and tools.",
      "Answer with the JSON object only, no prose.",
      "",
      `Description: ${describe}`,
    ].join("\n");
    const reply = await askLoom(prompt);
    const match = reply.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The Weaver's reply had no JSON config to prefill.");
    ($("#agent-config") as HTMLTextAreaElement).value = JSON.stringify(JSON.parse(match[0]), null, 2);
    err.textContent = "Config proposed — review it, then create the agent.";
  } catch (e) {
    err.textContent = `Could not build a config: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function submitAgentCreate() {
  const raw = ($("#agent-config") as HTMLTextAreaElement).value.trim();
  if (!raw) return;
  const err = $("#agent-create-error") as HTMLElement;
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    err.textContent = "The config is not valid JSON.";
    err.hidden = false;
    return;
  }
  err.hidden = true;
  try {
    const created = await createAgent(config);
    const name = (created as { name?: string }).name ?? (config.name as string | undefined) ?? "agent";
    ($("#agent-create-dialog") as HTMLDialogElement).close();
    agentsNotice(`Agent ${name} created.`);
    await refreshAgents();
    renderAgents();
    renderAgentBar();
  } catch (e) {
    err.textContent = `Could not create the agent: ${e instanceof Error ? e.message : String(e)}`;
    err.hidden = false;
  }
}

async function openTraceDialog(traceId: string) {
  const dialog = $("#trace-dialog") as HTMLDialogElement;
  const body = $("#trace-body") as HTMLElement;
  body.replaceChildren();
  body.append(Object.assign(document.createElement("p"), { textContent: "Loading trace…" }));
  dialog.showModal();
  try {
    const trace = await getTrace(traceId);
    body.replaceChildren();
    const dl = document.createElement("dl");
    dl.className = "trace-summary";
    const rows: [string, string][] = [
      ["Trace", trace.id],
      ["Session", trace.session_id || "(none)"],
      ["Total duration", `${trace.total_duration_ms} ms`],
      ["Spans", String(trace.spans?.length ?? 0)],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.append(dt, dd);
    }
    body.append(dl);
    for (const span of trace.spans ?? []) {
      const row = document.createElement("div");
      row.className = "trace-span";
      const name = document.createElement("strong");
      name.textContent = span.name;
      const meta = document.createElement("span");
      meta.textContent = `${span.status} · ${Math.round(span.duration_us / 1000)} ms`;
      row.append(name, meta);
      body.append(row);
    }
  } catch (err) {
    body.replaceChildren();
    body.append(Object.assign(document.createElement("p"), {
      textContent: `Could not load the trace: ${err instanceof Error ? err.message : String(err)}`,
    }));
  }
}

function showSessionNote(text: string, isError = false) {
  const note = $("#session-note") as HTMLElement;
  note.textContent = text;
  note.classList.toggle("error", isError);
  note.hidden = false;
  window.setTimeout(() => { note.hidden = true; }, 5000);
}

async function deleteSelectedSession() {
  const id = selectedSessionId;
  if (!id) return showSessionNote("No session selected.");
  if (!window.confirm("Delete this session and its history from the Loom server? This cannot be undone.")) return;
  try {
    await deleteSession(id);
    sessions = sessions.filter((s) => s.id !== id);
    if (selectedSessionId === id) {
      selectedSessionId = null;
      localStorage.removeItem(SESSION_KEY);
      sessionDetail = null;
      renderSessionDetail();
    }
    renderSessionBar();
    showSessionNote("Session deleted.");
  } catch (err) {
    showSessionNote(`Could not delete the session: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function resumeSelectedSession() {
  const id = selectedSessionId;
  if (!id) return showSessionNote("No session selected.");
  try {
    await resumeSession(id);
    showSessionNote("Resume requested — check the session state.");
    await refreshSessions();
  } catch (err) {
    showSessionNote(`Could not resume the session: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

// ---------------------------------------------------------------------------
// Session detail — expanded info about a session (GET /v1/sessions/{id})
// ---------------------------------------------------------------------------

function renderSessionDetail(): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const h = document.createElement("h4");
  h.textContent = "Session detail";
  section.append(h);

  if (!sessionDetail) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Select a session to see its details.";
    section.append(empty);
    return section;
  }

  const rows = [
    ["ID", sessionDetail.id],
    ["Name", sessionDetail.name || "(unnamed)"],
    ["State", sessionDetail.state],
    ["Backend", sessionDetail.backend],
    ["Agent", sessionDetail.agent_name || sessionDetail.agent_id || "(default)"],
    ["Messages", String(sessionDetail.conversation_count)],
    ["Created", sessionDetail.created_at > 0 ? new Date(sessionDetail.created_at * 1000).toLocaleString() : "—"],
    ["Updated", sessionDetail.updated_at > 0 ? new Date(sessionDetail.updated_at * 1000).toLocaleString() : "—"],
    ["Total cost", `$${sessionDetail.total_cost_usd.toFixed(4)}`],
    ["Artifacts", String(sessionDetail.artifact_count)],
  ];

  const dl = document.createElement("dl");
  dl.className = "session-detail-list";
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  section.append(dl);

  // Session completeness (§13): a crashed or interrupted turn can be
  // resumed or its execution gap resolved from the detail surface.
  if (sessionDetail.state === "interrupted" || sessionDetail.state === "error" || sessionDetail.state === "crashed") {
    const actions = document.createElement("div");
    actions.className = "session-actions";
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "btn";
    resume.textContent = "Resume session";
    resume.addEventListener("click", () => { void resumeSelectedSession(); });
    const resolve = document.createElement("button");
    resolve.type = "button";
    resolve.className = "btn ghost";
    resolve.textContent = "Resolve execution gap";
    resolve.addEventListener("click", async () => {
      const detail = sessionDetail;
      if (!detail) return;
      try {
        await resolveSessionGap(detail.id);
        await refreshSessionDetail(detail.id);
        showSessionNote("Execution gap resolved — check the session state.");
      } catch (err) {
        showSessionNote(`Could not resolve the gap: ${err instanceof Error ? err.message : String(err)}`, true);
      }
    });
    actions.append(resume, resolve);
    section.append(actions);
  }

  if (sessionDetail.metadata && Object.keys(sessionDetail.metadata).length > 0) {
    const metaH = document.createElement("h5");
    metaH.textContent = "Metadata";
    section.append(metaH);
    const metaDl = document.createElement("dl");
    metaDl.className = "session-detail-list";
    for (const [k, v] of Object.entries(sessionDetail.metadata)) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      metaDl.append(dt, dd);
    }
    section.append(metaDl);
  }

  return section;
}

// ---------------------------------------------------------------------------
// Agent detail — expanded info about an agent (GET /v1/agents/{id})
// ---------------------------------------------------------------------------

function renderAgentDetail(): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const h = document.createElement("h4");
  h.textContent = "Agent detail";
  section.append(h);

  if (!selectedAgentDetail) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Select an agent to see its details.";
    section.append(empty);
    return section;
  }

  const rows = [
    ["ID", selectedAgentDetail.id],
    ["Name", selectedAgentDetail.name],
    ["Status", selectedAgentDetail.status],
    ...(selectedAgentDetail.error ? [["Error", selectedAgentDetail.error] as [string, string]] : []),
    ["Uptime", selectedAgentDetail.uptime_seconds > 0
      ? `${Math.floor(selectedAgentDetail.uptime_seconds / 3600)}h ${Math.floor((selectedAgentDetail.uptime_seconds % 3600) / 60)}m`
      : "—"],
    ["Active sessions", String(selectedAgentDetail.active_sessions)],
    ["Total messages", String(selectedAgentDetail.total_messages)],
    ["Created", selectedAgentDetail.created_at > 0 ? new Date(selectedAgentDetail.created_at * 1000).toLocaleString() : "—"],
    ["Updated", selectedAgentDetail.updated_at > 0 ? new Date(selectedAgentDetail.updated_at * 1000).toLocaleString() : "—"],
  ];

  const dl = document.createElement("dl");
  dl.className = "agent-detail-list";
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  section.append(dl);
  return section;
}

// ---------------------------------------------------------------------------
// Evidence view — decided experiments + workflow results (workspace-wide)
// ---------------------------------------------------------------------------

function renderEvidence() {
  const list = $("#evidence-list");
  list.innerHTML = "";
  const items = evidenceItems();
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const text = document.createElement("p");
    text.textContent =
      "No evidence yet. Evidence appears here when experiment decisions are made or workflows produce results.";
    empty.append(text);
    list.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "flat-row";
    const head = document.createElement("div");
    head.className = "ev-head";
    const title = document.createElement("strong");
    title.textContent = item.title;
    head.append(title);
    const kind = document.createElement("span");
    kind.className = "ev-kind";
    kind.textContent = item.kindLabel;
    kind.title = `${item.kindLabel} evidence — what this claim rests on.`;
    head.append(kind);
    const detail = document.createElement("p");
    detail.className = "ev-detail";
    detail.textContent = item.detail;
    row.append(head, detail);
    list.append(row);
  }
}

// ---------------------------------------------------------------------------
// Appearance preferences (View menu)
// ---------------------------------------------------------------------------

const LAYERS_KEY = "loom-ide-tauri:layers";

function loadLayers() {
  try {
    const raw = localStorage.getItem(LAYERS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const key of Object.keys(layerOn)) {
      if (typeof obj[key] === "boolean") layerOn[key] = obj[key];
    }
  } catch {
    /* ignore */
  }
}

function saveLayers() {
  try {
    localStorage.setItem(LAYERS_KEY, JSON.stringify(layerOn));
  } catch {
    /* ignore */
  }
}

function applyLayerClasses() {
  const scene = document.querySelector(".scene");
  if (!scene) return;
  for (const [id, on] of Object.entries(layerOn)) {
    scene.classList.toggle(`no-${id}`, !on);
  }
}

// ---------------------------------------------------------------------------
// Artifacts view (Artifacts + Documents tabs)
// ---------------------------------------------------------------------------

function setArtifactTab(tab: "artifacts" | "documents") {
  artifactTab = tab;
  // A search belongs to the artifacts list, not the documents tab.
  const searchInput = document.querySelector<HTMLInputElement>("#artifact-search");
  if (searchInput) searchInput.value = "";
  const searchError = document.querySelector<HTMLElement>("#artifact-search-error");
  if (searchError) searchError.hidden = true;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("#artifact-tabs .tab")) {
    btn.classList.toggle("active", btn.dataset.atab === tab);
  }
  renderArtifacts();
  if (tab === "artifacts") {
    // Keep the global list fresh when the view is opened.
    void refreshGlobalArtifacts();
  }
}

/** Search artifacts on the server; a query under 2 characters restores
    the full list. Failures keep the previous list and say so. */
let artifactSearchTimer: ReturnType<typeof setTimeout> | undefined;
async function searchArtifactsView(query: string) {
  const errorEl = document.querySelector<HTMLElement>("#artifact-search-error");
  const q = query.trim();
  if (q.length < 2) {
    if (errorEl) errorEl.hidden = true;
    await refreshGlobalArtifacts();
    return;
  }
  try {
    artifacts = await searchArtifacts(q);
    setLoomReachable(true);
    if (errorEl) errorEl.hidden = true;
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    if (errorEl) {
      errorEl.textContent = `Could not search artifacts: ${err instanceof Error ? err.message : String(err)}`;
      errorEl.hidden = false;
    }
    /* keep the previous list */
  }
  renderArtifacts();
}

/** Reload the global artifact list (for the Artifacts view). */
async function refreshGlobalArtifacts() {
  try {
    artifacts = await listArtifacts();
    setLoomReachable(true);
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    /* keep the previous list */
  }
  renderArtifacts();
}

function renderArtifacts() {
  const list = $("#artifacts-list");
  list.innerHTML = "";
  if (artifactTab === "documents") {
    // The two real local documents. They start empty; clicking one
    // opens it in Code mode.
    for (const doc of NOTE_DOCS.filter((doc) => hasPreviousNote(doc.kind))) {
      const wrap = document.createElement("div");
      wrap.className = "flat-row";
      const card = document.createElement("button");
      card.type = "button";
      card.className = "artifact-card";
      const kind = document.createElement("span");
      kind.className = "artifact-kind";
      kind.textContent = "Note";
      const title = document.createElement("strong");
      title.textContent = doc.title;
      const detail = document.createElement("span");
      detail.className = "artifact-detail";
      detail.textContent = doc.detail;
      const chev = document.createElement("span");
      chev.className = "chev";
      chev.textContent = "›";
      card.append(kind, title, detail, chev);
      card.addEventListener("click", () => openNote(doc.kind));
      wrap.append(card);
      list.append(wrap);
    }
    return;
  }
  // Artifacts come from the Loom server (the global list, same rows as the
  // Work detail's Artifacts section, with the attach toggle when a work
  // is selected).
  if (!loomStatusKnown) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const title = document.createElement("strong");
    title.textContent = "Checking the Loom server…";
    empty.append(title);
    list.append(empty);
    return;
  }
  if (!loomReachable) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const title = document.createElement("strong");
    title.textContent = "Loom offline";
    const text = document.createElement("p");
    text.textContent = "The Loom server is not reachable, so no artifacts are visible.";
    empty.append(title, text);
    list.append(empty);
    return;
  }
  if (artifacts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const text = document.createElement("p");
    text.textContent = "No artifacts yet. Artifacts appear here when the Loom server shares them.";
    empty.append(text);
    list.append(empty);
    return;
  }
  const item = workItems.find((w) => w.id === selectedWorkId);
  const attached = new Set(item?.artifact_ids ?? []);
  for (const a of artifacts) {
    const row = document.createElement("div");
    row.className = "flat-row";
    const info = document.createElement("div");
    info.className = "artifact-info";
    const name = document.createElement("strong");
    name.textContent = a.name;
    info.append(name);
    const meta = [a.source, a.purpose].filter(Boolean).join(" · ");
    if (meta) {
      const span = document.createElement("span");
      span.textContent = meta;
      info.append(span);
    }
    row.append(info);
    // View loads the artifact's decoded content on demand (backend
    // get_artifact_content) and shows it directly under this row.
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn ghost";
    viewBtn.textContent = "View";
    let contentEl: HTMLPreElement | null = null;
    const showContent = (text: string) => {
      contentEl = document.createElement("pre");
      contentEl.className = "artifact-content";
      contentEl.textContent = text;
      row.after(contentEl);
      viewBtn.textContent = "Hide";
    };
    viewBtn.addEventListener("click", () => {
      if (contentEl) {
        contentEl.remove();
        contentEl = null;
        viewBtn.textContent = "View";
        return;
      }
      const cached = artifactContents.get(a.id);
      if (cached !== undefined) {
        showContent(cached);
        return;
      }
      if (artifactContentLoading.has(a.id)) return;
      artifactContentLoading.add(a.id);
      viewBtn.disabled = true;
      viewBtn.textContent = "Loading…";
      void getArtifactContent(a.id)
        .then((content) => {
          artifactContents.set(a.id, content);
          showContent(content);
        })
        .catch((err) => {
          showContent(`Could not load this artifact: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          artifactContentLoading.delete(a.id);
          viewBtn.disabled = false;
        });
    });
    row.append(viewBtn);
    if (item) {
      const isAttached = attached.has(a.id);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn" + (isAttached ? "" : " ghost");
      toggle.textContent = isAttached ? "Detach" : "Attach";
      toggle.addEventListener("click", () => {
        toggle.disabled = true;
        void toggleArtifact(item, a.id, isAttached);
      });
      row.append(toggle);
    }
    list.append(row);
  }
  if (artifacts.length === ARTIFACTS_LIMIT) {
    const note = document.createElement("p");
    note.className = "wd-sub-label";
    note.textContent =
      "Showing 200 artifacts — there may be more. Narrow the search to see the rest.";
    list.append(note);
  }
}

// ---------------------------------------------------------------------------
// Search (filters the work catalogue by title)
// ---------------------------------------------------------------------------

function openGlobalSearch() {
  setMode("work");
  if (isLeftDrawer()) openLeftDrawer();
  setSearchOpen(true);
}

function setSearchOpen(open: boolean) {
  const input = $("#search-input") as HTMLInputElement;
  const btn = $("#search-btn");
  input.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
  if (open) {
    input.focus();
  } else {
    input.value = "";
    applySearchFilter("");
  }
}

function applySearchFilter(query: string) {
  const input = document.querySelector<HTMLInputElement>("#search-input");
  if (!input) return;
  const q = query.trim().toLowerCase();
  let visible = 0;
  for (const li of document.querySelectorAll<HTMLLIElement>("#work-list li")) {
    const show = !q || (li.dataset.title ?? "").includes(q);
    li.hidden = !show;
    if (show) visible++;
  }
  $("#work-empty").hidden = visible > 0 || workItems.length === 0;
  knowledge?.search(query);
  const results = $("#knowledge-search-results");
  results.replaceChildren();
  if (q) {
    const matches = knowledge?.searchResults(q) ?? [];
    const heading = document.createElement("p"); heading.textContent = matches.length ? "Knowledge" : "No notes match this search."; results.append(heading);
    for (const note of matches) {
      const b = document.createElement("button"); b.type = "button"; b.className = "knowledge-search-result";
      b.textContent = note.meta.title; b.addEventListener("click", () => { void knowledge?.openNote(note.meta.id); }); results.append(b);
    }
  }
}

// ---------------------------------------------------------------------------
// Chat — starts empty; no invented replies. When the Loom server cannot
// be reached, the failure is shown as a connection error.
// ---------------------------------------------------------------------------

/** The unsent message, kept across close/reopen (and app restarts). */
const CHAT_DRAFT_KEY = "loom-ide-tauri:chat-draft";

function saveChatDraft() {
  const input = $("#chat-text") as HTMLInputElement;
  localStorage.setItem(CHAT_DRAFT_KEY, input.value);
  renderStatusPill();
}

function restoreChatDraft() {
  const input = $("#chat-text") as HTMLInputElement;
  input.value = localStorage.getItem(CHAT_DRAFT_KEY) ?? "";
}

function showChatHint() {
  const log = $("#chat-log");
  if (log.querySelector(".chat-msg") || log.querySelector(".chat-hint")) return;
  const hint = document.createElement("div");
  hint.className = "chat-hint";
  hint.textContent =
    "No messages yet. Ask Loom something — it answers when the Loom server is running on localhost:5006.";
  log.append(hint);
}

function hideChatHint() {
  document.querySelector("#chat-log .chat-hint")?.remove();
}

/** The conversation is scoped to the selected work; say so in the toolbar
    instead of showing the same thread as if it were global. */
function renderChatScope() {
  const scope = document.getElementById("chat-scope");
  if (!scope) return;
  const item = workItems.find((w) => w.id === selectedWorkId);
  scope.textContent = item ? item.title : "No work selected";
  scope.title = item
    ? `Conversation for: ${item.title}`
    : "Conversation not linked to a work item";
}

function addChatMessage(
  who: "user" | "loom",
  text: string,
  reply?: ChatReply,
  live = true,
) {
  hideChatHint();
  const log = $("#chat-log");
  const msg = document.createElement("div");
  msg.className = `chat-msg ${who}`;

  if (who === "loom") {
    const head = document.createElement("div");
    head.className = "who";
    const ring = document.createElement("span");
    ring.className = "mini-ring";
    head.append(ring);
    msg.append(head);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.append(bubble);

  if (reply?.card) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "msg-card";
    card.innerHTML = `
      <svg class="flask" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 3h6"/><path d="M10 3v5.5L4.5 18a2.4 2.4 0 0 0 2.1 3.5h10.8a2.4 2.4 0 0 0 2.1-3.5L14 8.5V3"/><path d="M7.5 14h9"/>
      </svg>
      <span class="card-text"><strong></strong><span></span></span>
      <span class="chev">›</span>`;
    (card.querySelector("strong") as HTMLElement).textContent = reply.card.title;
    (card.querySelector(".card-text span") as HTMLElement).textContent = reply.card.detail;
    card.addEventListener("click", () => setMode("artifacts"));
    msg.append(card);
  }

  if (reply?.trace_id) {
    const traceBtn = document.createElement("button");
    traceBtn.type = "button";
    traceBtn.className = "chat-trace";
    traceBtn.textContent = "View trace ›";
    traceBtn.addEventListener("click", () => { void openTraceDialog(reply.trace_id as string); });
    msg.append(traceBtn);
  }

  if (who === "loom" && live) {
    const src = document.createElement("span");
    src.className = "chat-source";
    const parts: string[] = ["Live — answered by the Loom server"];
    if (reply?.evidenceKind) {
      parts.push(evidenceKindLabel(reply.evidenceKind));
    }
    src.textContent = parts.join(" · ");
    msg.append(src);
  }

  log.append(msg);
  log.scrollTop = log.scrollHeight;
}

/** A connection error is shown in the chat itself, not as a reply. */
function addChatError(text: string) {
  openRight("conversation");
  hideChatHint();
  const log = $("#chat-log");
  const msg = document.createElement("div");
  msg.className = "chat-msg loom chat-error";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.append(bubble);
  log.append(msg);
  log.scrollTop = log.scrollHeight;
}

/** The in-flight state of one streamed weave, keyed by request id. */
interface StreamReplyState {
  workId: string | null;
  cacheKey: string;
  msg: HTMLElement;
  bubble: HTMLElement;
  text: string;
  clean: string;
  toolLines: Map<string, HTMLElement>;
  clarifications: Set<string>;
  sessionId: string | null;
  finished: boolean;
}

const activeStreams = new Map<string, StreamReplyState>();

function scrollChat() {
  const log = $("#chat-log");
  log.scrollTop = log.scrollHeight;
}

function renderChatControls() {
  const stop = $("#chat-stop") as HTMLButtonElement | null;
  if (stop) stop.hidden = !(chatInFlight > 0 && activeStreamId !== null);
}

/** Adopt the most recently updated session when the server auto-created
    one mid-stream (clarifications must be answered against a session). */
function newestSessionId(): string | null {
  const sorted = [...sessions].sort((a, b) => b.updated_at - a.updated_at);
  return sorted[0]?.id ?? null;
}

/** A streamed weave's progress: partial tokens, tool lifecycle, and
    human-in-the-loop questions — all rendered incrementally. */
function handleStreamEvent(p: LoomStreamEvent) {
  const st = activeStreams.get(p.requestId);
  if (!st || st.finished) return;

  if (p.kind === "progress" && p.event) {
    const e = p.event;
    // Any progress proves the server answered — the same "verified" bar
    // the unary path sets on a completed reply.
    loomVerified = true;
    setLoomReachable(true);
    if (typeof e.partial_content === "string" && e.partial_content !== st.text) {
      st.text = e.partial_content;
      st.bubble.textContent = st.text;
      scrollChat();
    }
    if (e.is_tool_started || e.is_tool_completed) {
      renderToolLine(st, e);
    }
    if (e.hitl_request?.request_id && !st.clarifications.has(e.hitl_request.request_id)) {
      st.clarifications.add(e.hitl_request.request_id);
      renderHitlCard(st, e.hitl_request as {
        request_id: string;
        question?: string;
        kind?: string;
        summary?: string;
      });
    }
    return;
  }

  finishStream(st, p.requestId, p.kind as "done" | "error" | "cancelled", p.error ?? undefined);
}

function renderToolLine(st: StreamReplyState, e: LoomStreamEvent["event"] & object) {
  const id = (e as { tool_call_id?: string }).tool_call_id;
  let line = id ? st.toolLines.get(id) : undefined;
  if (!line) {
    line = document.createElement("div");
    line.className = "chat-tool";
    st.msg.append(line);
    if (id) st.toolLines.set(id, line);
  }
  const name = (e as { tool_name?: string }).tool_name || "tool";
  const completed = Boolean((e as { is_tool_completed?: boolean }).is_tool_completed);
  if (completed) {
    const ok = (e as { tool_success?: boolean }).tool_success !== false;
    line.textContent = `⚙ ${name} — ${ok ? "done" : "failed"}`;
    line.classList.toggle("tool-failed", !ok);
    const err = (e as { tool_error?: string }).tool_error;
    if (!ok && err) line.title = err;
  } else {
    line.textContent = `⚙ ${name} …`;
    line.classList.remove("tool-failed");
    line.title = "";
  }
  scrollChat();
}

/** A mid-turn human-in-the-loop card: questions get an answer field;
    approvals (held tool calls) get Approve/Deny. Both deliver through the
    clarification-answer path, whose request_id is the hold's handle. */
function renderHitlCard(
  st: StreamReplyState,
  hitl: { request_id: string; question?: string; kind?: string; summary?: string },
) {
  const card = document.createElement("div");
  card.className = "chat-clarification";
  const isApproval = hitl.kind === "approval";
  const q = document.createElement("p");
  q.textContent = hitl.question?.trim() || hitl.summary?.trim() ||
    (isApproval ? "Loom's agent is asking to run a tool." : "The agent has a question for you.");
  card.append(q);
  const row = document.createElement("div");
  row.className = "chat-clarification-row";
  const deliver = async (answer: string, buttons: HTMLButtonElement[]) => {
    for (const b of buttons) b.disabled = true;
    try {
      let sid = st.sessionId ?? activeStreamSessionId;
      if (!sid) {
        await refreshSessions();
        sid = newestSessionId();
        if (sid) st.sessionId = sid;
      }
      if (!sid) throw new Error("The conversation session is not known yet.");
      await answerClarification(sid, hitl.request_id, answer);
      const done = document.createElement("p");
      done.className = "chat-clarification-done";
      done.textContent = `Answered — the agent continues.`;
      card.append(done);
      row.hidden = true;
    } catch (err) {
      const fail = document.createElement("p");
      fail.className = "chat-clarification-done error";
      fail.textContent = `Could not deliver the answer: ${err instanceof Error ? err.message : String(err)}`;
      card.append(fail);
      for (const b of buttons) b.disabled = false;
    }
  };
  if (isApproval) {
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn";
    approve.textContent = "Approve";
    const deny = document.createElement("button");
    deny.type = "button";
    deny.className = "btn ghost";
    deny.textContent = "Deny";
    row.append(approve, deny);
    card.append(row);
    approve.addEventListener("click", () => { void deliver("approve", [approve, deny]); });
    deny.addEventListener("click", () => { void deliver("deny", [approve, deny]); });
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Your answer…";
    input.setAttribute("aria-label", "Answer the agent's question");
    const answer = document.createElement("button");
    answer.type = "button";
    answer.className = "btn";
    answer.textContent = "Answer";
    row.append(input, answer);
    card.append(row);
    answer.addEventListener("click", () => {
      const value = input.value.trim();
      if (!value || answer.disabled) return;
      input.disabled = true;
      void deliver(value, [answer]);
    });
  }
  st.msg.append(card);
  scrollChat();
}

function finishStream(
  st: StreamReplyState,
  requestId: string,
  kind: "done" | "error" | "cancelled",
  error?: string,
) {
  st.finished = true;
  activeStreams.delete(requestId);
  if (activeStreamId === requestId) activeStreamId = null;
  if (activeStreams.size === 0) chatInFlight--;
  renderChatControls();
  renderStatusPill();

  if (kind === "cancelled") {
    const note = document.createElement("p");
    note.className = "chat-stopped";
    note.textContent = st.text ? "Stopped. The reply above is partial." : "Stopped before Loom answered.";
    st.msg.append(note);
    setSphereState("idle");
    return;
  }

  if (kind === "error") {
    if (error && isLoomConnectionError(new Error(error))) {
      setLoomReachable(false);
      // Streaming forces a real connection model: re-check once, shortly.
      window.setTimeout(() => {
        void getLoomStatus().then((s) => setLoomReachable(s.online));
      }, 3000);
    }
    const note = document.createElement("p");
    note.className = "chat-stopped error";
    note.textContent = `Loom stopped answering: ${error ?? "unknown error"}.`;
    st.msg.append(note);
    if (!st.text) addChatError(`Could not reach Loom: ${error ?? "unknown error"}. Start the Loom service and send your message again.`);
    setSphereState("error");
    // A failed send returns the text to the composer so it survives a close.
    if (!st.text) {
      ($("#chat-text") as HTMLInputElement).value = st.clean;
      localStorage.setItem(CHAT_DRAFT_KEY, st.clean);
    }
    return;
  }

  // kind === "done": adopt the session, finalize the message, refresh.
  void (async () => {
    const finalText = st.text.trim();
    if (!finalText) {
      st.bubble.textContent = "Loom finished without streaming text.";
    }
    loomVerified = true;
    setLoomReachable(true);
    cacheChatMessage(st.cacheKey, "loom", st.bubble.textContent || "");
    if (st.sessionId && !sessions.some((s) => s.id === st.sessionId)) {
      await refreshSessions();
    }
    const sessionId = st.sessionId ?? (selectedSessionId ?? newestSessionId());
    if (sessionId && !st.sessionId && !selectedSessionId) {
      st.sessionId = sessionId;
    }
    if (st.sessionId && st.workId) {
      try {
        const linked = await setWorkSession(st.workId, st.sessionId);
        workItems = workItems.map((w) => (w.id === linked.id ? linked : w));
        renderWorkList();
        if (selectedWorkId === st.workId) {
          selectedSessionId = st.sessionId;
          renderSessionBar();
          void loadWorkArtifacts(st.workId);
        }
      } catch {
        /* link is best-effort */
      }
    } else if (st.sessionId && selectedWorkId === st.workId && !selectedSessionId) {
      selectedSessionId = st.sessionId;
      renderSessionBar();
    }
    // The answering agent's counters just changed.
    try {
      await refreshAgents();
    } catch {
      /* agent refresh is best-effort */
    }
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
    renderChatControls();
  })();
}

/** The unary path, kept as the fallback when the stream cannot start (a
    server that doesn't offer streaming, or a start failure). */
async function sendChatUnary(
  clean: string,
  workId: string | null,
  cacheKey: string,
  typing: HTMLElement,
) {
  try {
    const reply = await askLoom(
      clean,
      selectedSessionId ?? undefined,
      selectedAgentId ?? undefined,
    );
    typing.remove();
    loomVerified = true;
    setLoomReachable(true);
    // Append to the visible log only if this work is still selected; the
    // reply is always cached under the work it was sent from.
    if (selectedWorkId === workId) {
      addChatMessage("loom", reply.text, reply);
    }
    cacheChatMessage(cacheKey, "loom", reply.text);
    // Refresh agent activity: the answering agent's counters just changed.
    await refreshAgents();
    // Adopt the session the server reports (it may have auto-created one)
    // and link it to the work the message was sent from.
    if (reply.session_id) {
      if (!sessions.some((s) => s.id === reply.session_id)) {
        await refreshSessions();
      }
      if (workId) {
        try {
          const linked = await setWorkSession(workId, reply.session_id);
          workItems = workItems.map((w) => (w.id === linked.id ? linked : w));
          renderWorkList();
          if (selectedWorkId === workId) {
            selectedSessionId = reply.session_id;
            renderSessionBar();
            void loadWorkArtifacts(workId);
          }
        } catch {
          /* link is best-effort */
        }
      } else if (selectedWorkId === workId) {
        selectedSessionId = reply.session_id;
        renderSessionBar();
      }
    }
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    typing.remove();
    // Keep the failed text in the composer and in storage so it survives
    // an app close after a failed send.
    ($("#chat-text") as HTMLInputElement).value = clean;
    localStorage.setItem(CHAT_DRAFT_KEY, clean);
    if (isLoomConnectionError(err)) setLoomReachable(false);
    const detail = err instanceof Error ? err.message : String(err);
    const guidance = /looms serve|Start the Loom/i.test(detail)
      ? ""
      : " Start the Loom service and send your message again.";
    addChatError(`Could not reach Loom: ${detail}.${guidance}`);
    setSphereState("error");
  } finally {
    chatInFlight--;
    renderChatControls();
    renderStatusPill();
  }
}

async function sendChat(text: string) {
  const clean = text.trim();
  if (!clean) return;
  // Capture the work at send time: the user may switch work while the
  // reply is in flight, and the reply (and the session link) belongs to
  // the work it was sent from.
  const workId = selectedWorkId;
  const cacheKey = workId ?? UNASSIGNED_KEY;
  addChatMessage("user", clean);
  cacheChatMessage(cacheKey, "user", clean);
  chatInFlight++;
  setSphereState("processing");

  const log = $("#chat-log");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "Loom is thinking…";
  log.append(typing);
  log.scrollTop = log.scrollHeight;

  // Streaming first: incremental tokens, tool calls in flight, a Stop
  // button, and inline clarification answers. The unary path is the
  // fallback for a server that doesn't stream.
  const requestId = `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await askLoomStream(
      requestId,
      clean,
      selectedSessionId ?? undefined,
      selectedAgentId ?? undefined,
    );
  } catch {
    chatInFlight--;
    await sendChatUnary(clean, workId, cacheKey, typing);
    return;
  }

  typing.remove();
  const msg = document.createElement("div");
  msg.className = "chat-msg loom";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "";
  msg.append(bubble);
  log.append(msg);
  const state: StreamReplyState = {
    workId,
    cacheKey,
    msg,
    bubble,
    text: "",
    clean,
    toolLines: new Map(),
    clarifications: new Set(),
    sessionId: selectedSessionId,
    finished: false,
  };
  activeStreams.set(requestId, state);
  activeStreamId = requestId;
  activeStreamSessionId = selectedSessionId;
  renderChatControls();
  log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------------------
// Sessions + agents — the conversation's session concept. Sessions and agents
// come from the Loom server; when it is offline the selects stay honest
// ("Loom offline") and sending a message surfaces the connection error.
// ---------------------------------------------------------------------------

const SESSION_KEY = "loom-ide-tauri:session";
const AGENT_KEY = "loom-ide-tauri:agent";

function sessionLabel(s: Session): string {
  const name = s.name?.trim();
  if (name) {
    const agent = s.agent_name?.trim();
    return agent && agent !== name ? `${name} — ${agent}` : name;
  }
  return `Session ${s.id.slice(0, 8)}`;
}

function renderSessionBar() {
  const sel = $("#session-select") as HTMLSelectElement;
  const previous = selectedSessionId ?? sel.value;
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = sessions.length === 0 ? "No sessions" : "No session";
  sel.append(none);
  for (const s of sessions) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = sessionLabel(s);
    sel.append(opt);
  }
  if (sessions.length === SESSIONS_LIMIT) {
    const more = document.createElement("option");
    more.disabled = true;
    more.textContent = "— there may be more sessions —";
    sel.append(more);
  }
  // Render only: never drop the selection here. If the adopted session is
  // not in the list yet, the dropdown shows "No session" until the next
  // refresh brings it — the selection itself survives.
  sel.value = sessions.some((s) => s.id === previous) ? previous : "";
  sel.disabled = sessions.length === 0;
  sel.title =
    sessions.length === 0
      ? loomReachable
        ? "No sessions yet"
        : "The Loom server is offline. Sessions are unavailable"
      : sessions.length === SESSIONS_LIMIT
        ? "Showing 500 sessions — there may be more"
        : "Conversation session";
  const newSession = document.getElementById("session-new") as HTMLButtonElement | null;
  if (newSession) {
    newSession.disabled = !loomReachable;
    newSession.title = loomReachable
      ? "New session"
      : "A new session needs the Loom server";
  }
}

function renderAgentBar() {
  const sel = $("#agent-select") as HTMLSelectElement;
  const previous = selectedAgentId ?? sel.value;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Default agent";
  sel.append(def);
  for (const a of agents) {
    const opt = document.createElement("option");
    opt.value = a.name || a.id;
    opt.textContent =
      a.status && a.status !== "running" ? `${a.name} (${a.status})` : a.name;
    sel.append(opt);
  }
  // Render only: the selection is owned by the caller, never by this render.
  sel.value = agents.some((a) => (a.name || a.id) === previous) ? previous : "";
  sel.disabled = agents.length === 0;
  sel.title =
    agents.length === 0
      ? loomReachable
        ? "No agents registered"
        : "The Loom server is offline — agents are unavailable"
      : "Agent";
}

async function refreshSessions() {
  try {
    sessions = await listSessions();
    setLoomReachable(true);
  } catch (err) {
    sessions = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  renderSessionBar();
}

async function refreshAgents() {
  try {
    agents = await listAgents();
    setLoomReachable(true);
  } catch (err) {
    agents = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  renderAgentBar();
  renderAgents();
  // The inspector shows the same agents; keep it in sync with the Agents view.
  renderInspectorContext();
}

// ---- New Loom data refresh functions (exposing more of the Loom API) ----

async function refreshSessionDetail(sessionId: string) {
  try {
    sessionDetail = await getSession(sessionId);
    setLoomReachable(true);
  } catch (err) {
    sessionDetail = null;
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  renderInspectorContext();
}

async function refreshTools() {
  try {
    tools = await listTools();
    setLoomReachable(true);
  } catch (err) {
    tools = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

async function refreshAgentDetail(agentId: string) {
  try {
    selectedAgentDetail = await getAgent(agentId);
    setLoomReachable(true);
  } catch (err) {
    selectedAgentDetail = null;
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  renderInspectorContext();
}

async function refreshModels() {
  try {
    models = await listModels();
    setLoomReachable(true);
  } catch (err) {
    models = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

async function refreshProviders() {
  try {
    providers = await listProviders();
    setLoomReachable(true);
  } catch (err) {
    providers = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

async function refreshArtifactStats() {
  try {
    artifactStats = await getArtifactStats();
    setLoomReachable(true);
  } catch (err) {
    artifactStats = null;
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

async function refreshServerConfig() {
  try {
    serverConfig = await getServerConfig();
    setLoomReachable(true);
  } catch (err) {
    serverConfig = null;
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

async function refreshStorageStatus() {
  try {
    storageStatus = await getStorageStatus();
    setLoomReachable(true);
  } catch (err) {
    storageStatus = null;
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
}

// ---------------------------------------------------------------------------
// Work ↔ session binding. Each work item owns one Loom session; selecting a
// work item switches the conversation to that session and loads its history.
// ---------------------------------------------------------------------------

/** Clear the conversation log (keeps the unsent draft intact). */
function clearChat() {
  const log = $("#chat-log");
  log.innerHTML = "";
  showChatHint();
}

// ---------------------------------------------------------------------------
// Chat conversation cache. Each work item owns its conversation; the cache
// keeps it across work switches (and restarts, via localStorage). The Loom
// session history is fetched only when there is no cached copy.
// ---------------------------------------------------------------------------

interface CachedChatMsg {
  who: "user" | "loom";
  text: string;
}

const CHAT_CACHE_KEY = "loom-ide-tauri:chat-cache";
/** Cache key for messages sent with no work selected. */
const UNASSIGNED_KEY = "__unassigned";
/** Per-work cap, and a rough total cap for the serialized cache. */
const CHAT_CACHE_MAX_PER_WORK = 100;
const CHAT_CACHE_MAX_BYTES = 4_000_000;
const chatCache = new Map<string, CachedChatMsg[]>();
let chatCacheWarned = false;

function loadChatCache() {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, CachedChatMsg[]>;
      for (const [k, v] of Object.entries(obj)) {
        // Prune stale oversized entries from older runs.
        chatCache.set(k, Array.isArray(v) ? v.slice(-CHAT_CACHE_MAX_PER_WORK) : []);
      }
    }
  } catch {
    /* ignore */
  }
}

function saveChatCache() {
  try {
    const obj: Record<string, CachedChatMsg[]> = {};
    for (const [k, v] of chatCache) obj[k] = v;
    let serialized = JSON.stringify(obj);
    // Shrink oldest-first until the cache fits localStorage: halve every
    // work's history, then drop whole conversations (keeping the current
    // work's) until it fits.
    let perWork = CHAT_CACHE_MAX_PER_WORK;
    while (serialized.length > CHAT_CACHE_MAX_BYTES && perWork > 1) {
      perWork = Math.max(1, Math.floor(perWork / 2));
      for (const [k, v] of chatCache) chatCache.set(k, v.slice(-perWork));
      const trimmed: Record<string, CachedChatMsg[]> = {};
      for (const [k, v] of chatCache) trimmed[k] = v;
      serialized = JSON.stringify(trimmed);
    }
    if (serialized.length > CHAT_CACHE_MAX_BYTES) {
      for (const k of [...chatCache.keys()]) {
        if (k !== (selectedWorkId ?? UNASSIGNED_KEY)) chatCache.delete(k);
      }
      const trimmed: Record<string, CachedChatMsg[]> = {};
      for (const [k, v] of chatCache) trimmed[k] = v;
      serialized = JSON.stringify(trimmed);
    }
    localStorage.setItem(CHAT_CACHE_KEY, serialized);
  } catch {
    if (!chatCacheWarned) {
      chatCacheWarned = true;
      addChatError(
        "Chat history could not be saved on this device (browser storage is full or unavailable). Messages still show for this session, but may not survive a restart.",
      );
    }
  }
}

function cacheChatMessage(workId: string, who: "user" | "loom", text: string) {
  const msgs = chatCache.get(workId) ?? [];
  msgs.push({ who, text });
  chatCache.set(workId, msgs.slice(-CHAT_CACHE_MAX_PER_WORK));
  saveChatCache();
}

function renderChatMessages(msgs: CachedChatMsg[]) {
  const log = $("#chat-log");
  log.innerHTML = "";
  if (msgs.length === 0) {
    showChatHint();
    return;
  }
  for (const m of msgs) {
    addChatMessage(m.who, m.text, undefined, false);
  }
}

/** Show the conversation for a work item: the cached copy first, the Loom
    session history only when there is no cache for that work yet. With no
    work selected, the unassigned conversation is shown instead. */
function loadChatForWork(workId: string | null, sessionId: string | null) {
  const key = workId ?? UNASSIGNED_KEY;
  const cached = chatCache.get(key);
  if (cached && cached.length > 0) {
    renderChatMessages(cached);
    return;
  }
  if (sessionId) {
    // No cached copy: the visible log belongs to another work (or is
    // empty), so clear it before the history fetch.
    clearChat();
    void loadChatHistory(sessionId, workId);
  } else {
    clearChat();
  }
}

async function loadChatHistory(sessionId: string, workId: string | null) {
  try {
    const messages = await getSessionHistory(sessionId);
    setLoomReachable(true);
    const msgs: CachedChatMsg[] = messages
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({
        who: m.role === "user" ? "user" : "loom",
        text: m.content,
      }));
    if (workId) {
      chatCache.set(workId, msgs.slice(-CHAT_CACHE_MAX_PER_WORK));
      saveChatCache();
    }
    renderChatMessages(msgs);
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    // Leave the log untouched: the previous conversation stays visible
    // instead of vanishing on a failed fetch.
    showChatHint();
  }
}

/** Follow the selected work item's session: switch the session selector,
    switch the agent to the session's agent, and show that conversation. */
function syncSessionToWork() {
  const item = workItems.find((w) => w.id === selectedWorkId);
  const sid = item?.session_id ?? null;
  if (sid) {
    selectedSessionId = sid;
    const sess = sessions.find((s) => s.id === sid);
    // A session with no agent resets the selector to Default instead of
    // leaving the previous work's agent selected.
    selectedAgentId = sess?.agent_id || null;
    renderAgentBar();
    renderSessionBar();
    loadChatForWork(selectedWorkId, sid);
    void refreshSessionDetail(sid);
  } else {
    selectedSessionId = null;
    selectedAgentId = null;
    selectedAgentDetail = null;
    sessionDetail = null;
    renderAgentBar();
    renderSessionBar();
    renderInspectorContext();
    loadChatForWork(selectedWorkId, null);
  }
}

// ---------------------------------------------------------------------------
// User workspace files, separate from Loom server and application storage.
// ---------------------------------------------------------------------------

const dirCache = new Map<string, DirEntry[]>();
const expandedDirs = new Set<string>();
let openFilePath: string | null = null;
let openFileOriginal: string | null = null;
let workspaceInfo: WorkspaceInfo | null = null;
let documentRequest = 0;
let saveInFlight: Promise<boolean> | null = null;
let folderOpening = false;

function workspaceLabel(path: string) {
  const value = path.replaceAll("\\", "/");
  const root = workspaceInfo?.path.replaceAll("\\", "/").replace(/\/$/, "");
  return root && value.startsWith(`${root}/`) ? value.slice(root.length + 1) : value.split("/").at(-1) ?? value;
}
let fileCreation: { kind: "file" | "folder"; parent: string } | null = null;
let fileCreationPending = false;

function beginFileCreation(kind: "file" | "folder", parent = "") {
  if (fileCreationPending || !workspaceInfo) return;
  fileCreation = { kind, parent };
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(".tree-actions")) menu.open = false;
  $("#file-create-form").hidden = false;
  $("#file-create-label").textContent = kind === "file" ? "File name" : "Folder name";
  $("#file-create-submit").textContent = kind === "file" ? "Create file" : "Create folder";
  $("#file-create-destination").textContent = `In: ${parent ? workspaceLabel(parent) : workspaceInfo.name}`;
  $("#file-create-error").hidden = true;
  $("#file-tree-status").hidden = true;
  const input = $("#file-create-name") as HTMLInputElement;
  input.value = "";
  input.placeholder = kind === "file" ? "Filename, including extension" : "Folder name";
  input.focus();
}

function cancelFileCreation() {
  if (fileCreationPending) return;
  const kind = fileCreation?.kind;
  fileCreation = null;
  $("#file-create-form").hidden = true;
  $(kind === "folder" ? "#file-new-folder" : "#file-new-file").focus();
}

async function submitFileCreation(event: SubmitEvent) {
  event.preventDefault();
  if (!fileCreation || fileCreationPending) return;
  const { kind, parent } = fileCreation;
  const previousDocumentRequest = documentRequest;
  const input = $("#file-create-name") as HTMLInputElement;
  const name = input.value.trim();
  const error = $("#file-create-error");
  if (!name) {
    error.textContent = "Enter a name.";
    error.hidden = false;
    input.focus();
    return;
  }
  fileCreationPending = true;
  const controls = document.querySelectorAll<HTMLInputElement | HTMLButtonElement>("#file-create-form input, #file-create-form button");
  controls.forEach((control) => control.disabled = true);
  $("#file-create-submit").textContent = "Creating…";
  error.hidden = true;
  let created: DirEntry;
  try {
    created = kind === "file"
      ? await createWorkspaceFile(parent, name)
      : await createWorkspaceDirectory(parent, name);
  } catch (err) {
    error.textContent = err instanceof Error ? err.message : String(err);
    error.hidden = false;
    return;
  } finally {
    fileCreationPending = false;
    controls.forEach((control) => control.disabled = false);
    $("#file-create-submit").textContent = kind === "file" ? "Create file" : "Create folder";
    if (!error.hidden) input.focus();
  }
  // Creation succeeded. A failed refresh must not invite a duplicate retry.
  fileCreation = null;
  $("#file-create-form").hidden = true;
  const status = $("#file-tree-status");
  status.hidden = false;
  status.textContent = `Created ${kind}: ${created.name}`;
  try {
    dirCache.set(parent, parent ? await listDirectory(parent) : await listWorkspace());
    if (parent) expandedDirs.add(parent);
    if (created.is_dir) {
      expandedDirs.add(created.path);
      dirCache.set(created.path, []);
    }
    renderFileTree();
  } catch (err) {
    status.textContent = `Created ${kind}: ${created.name}. Could not refresh the folder: ${err instanceof Error ? err.message : String(err)}. Use Refresh to reload it.`;
  }
  if (!created.is_dir && documentRequest === previousDocumentRequest) await openFile(created.path);
  else $("#file-new-folder").focus();
}

function renderFileTree() {
  const tree = $("#file-tree");
  tree.innerHTML = "";
  const root = dirCache.get("") ?? [];
  if (root.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tree-empty";
    empty.textContent = workspaceInfo ? "No files yet." : "";
    tree.append(empty);
    return;
  }
  appendTreeNodes(tree, root, 0);
}

function appendTreeNodes(parent: HTMLElement, entries: DirEntry[], depth: number) {
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "tree-row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tree-btn" + (entry.is_dir ? "" : " tree-file");
    btn.style.paddingLeft = `${8 + depth * 14}px`;
    const chev = document.createElement("span");
    chev.className = "tree-chev";
    chev.textContent = entry.is_dir ? (expandedDirs.has(entry.path) ? "▾" : "▸") : "";
    const name = document.createElement("span");
    name.className = "tree-name";
    name.textContent = entry.is_dir ? `${entry.name}/` : entry.name;
    btn.append(chev, name);
    if (entry.path === openFilePath) btn.classList.add("selected");
    if (entry.is_dir) {
      btn.addEventListener("click", () => toggleDir(entry.path));
    } else {
      btn.addEventListener("click", () => openFile(entry.path));
    }
    row.append(btn);
    if (entry.is_dir) {
      const actions = document.createElement("details");
      actions.className = "tree-actions";
      const toggle = document.createElement("summary");
      toggle.textContent = "⋯";
      toggle.title = `Create in ${entry.name}`;
      toggle.setAttribute("aria-label", `Actions for folder ${entry.name}`);
      const menu = document.createElement("div");
      menu.className = "tree-action-menu";
      for (const kind of ["file", "folder"] as const) {
        const create = document.createElement("button");
        create.type = "button";
        create.textContent = kind === "file" ? "New file" : "New folder";
        create.addEventListener("click", () => beginFileCreation(kind, entry.path));
        menu.append(create);
      }
      actions.append(toggle, menu);
      actions.addEventListener("toggle", () => {
        if (actions.open) {
          for (const other of document.querySelectorAll<HTMLDetailsElement>(".tree-actions")) {
            if (other !== actions) other.open = false;
          }
        }
      });
      row.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        actions.open = true;
        menu.querySelector("button")?.focus();
      });
      actions.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          actions.open = false;
          toggle.focus();
        }
      });
      row.append(actions);
    }
    parent.append(row);
    if (entry.is_dir && expandedDirs.has(entry.path)) {
      appendTreeNodes(parent, dirCache.get(entry.path) ?? [], depth + 1);
    }
  }
}

async function toggleDir(path: string) {
  if (expandedDirs.has(path)) {
    expandedDirs.delete(path);
    renderFileTree();
    return;
  }
  expandedDirs.add(path);
  if (!dirCache.has(path)) {
    try {
      dirCache.set(path, await listDirectory(path));
    } catch {
      dirCache.set(path, []);
      expandedDirs.delete(path);
      renderFileTree();
      return;
    }
  }
  renderFileTree();
}

async function openFile(path: string) {
  const request = ++documentRequest;
  if (!await saveNote() || request !== documentRequest) return;
  try {
    const text = await readFile(path);
    if (request !== documentRequest) return;
    openFilePath = path;
    openFileOriginal = text;
    currentNote = null;
    ($("#code-editor") as HTMLTextAreaElement).value = text;
    $("#code-error").hidden = true;
    renderEditor();
    renderFileTree();
  } catch (error) {
    if (request !== documentRequest) return;
    showEditorError(error);
  }
}

async function loadWorkspaceTree() {
  const tree = $("#file-tree");
  try {
    workspaceInfo = await getWorkspace();
    $("#workspace-name").textContent = workspaceInfo?.name ?? "Files";
    for (const id of ["file-new-file", "file-new-folder", "canvas-new-file"]) {
      ($("#" + id) as HTMLButtonElement).disabled = !workspaceInfo;
    }
    dirCache.set("", workspaceInfo ? await listWorkspace() : []);
    renderFileTree();
  } catch {
    tree.replaceChildren();
    const error = document.createElement("p");
    error.className = "tree-empty";
    error.textContent = "Could not open this folder. Use File → Open folder to choose it again.";
    tree.append(error);
  }
}

function showFolderDialog() {
  const dialog = $("#open-folder-dialog") as HTMLDialogElement;
  ($("#open-folder-path") as HTMLInputElement).value = workspaceInfo?.path ?? "";
  $("#open-folder-error").hidden = true;
  dialog.showModal();
  ($("#open-folder-path") as HTMLInputElement).select();
}

async function submitFolder(event: SubmitEvent) {
  event.preventDefault();
  if (folderOpening || fileCreationPending) return;
  folderOpening = true;
  const button = $("#open-folder-submit") as HTMLButtonElement;
  button.disabled = true;
  try {
    if (!await saveNote()) throw new Error("Save or reload your current file before opening another folder.");
    const info = await openWorkspace(($("#open-folder-path") as HTMLInputElement).value);
    ++documentRequest;
    workspaceInfo = info;
    dirCache.clear();
    expandedDirs.clear();
    clearEditor();
    fileCreation = null;
    $("#file-create-form").hidden = true;
    $("#file-tree-status").hidden = true;
    ($("#open-folder-dialog") as HTMLDialogElement).close();
    setMode("code");
    await loadWorkspaceTree();
  } catch (error) {
    const message = $("#open-folder-error");
    message.textContent = error instanceof Error ? error.message : String(error);
    message.hidden = false;
  } finally {
    button.disabled = false;
    folderOpening = false;
  }
}

function initWorkspaceExplorer() {
  // The user chooses the content folder; app/server files never become the default tree.
  $("#canvas-new-file").addEventListener("click", () => beginFileCreation("file"));
  $("#canvas-open-folder").addEventListener("click", showFolderDialog);
  ($("#canvas-open-folder") as HTMLButtonElement).disabled = !isTauri;
  $("#open-folder-form").addEventListener("submit", (event) => { void submitFolder(event as SubmitEvent); });
  $("#open-folder-dialog").addEventListener("cancel", (event) => {
    if (folderOpening) event.preventDefault();
  });
  $("#open-folder-cancel").addEventListener("click", () => {
    if (!folderOpening) ($("#open-folder-dialog") as HTMLDialogElement).close();
  });
  $("#file-new-file").addEventListener("click", () => beginFileCreation("file"));
  $("#file-new-folder").addEventListener("click", () => beginFileCreation("folder"));
  $("#file-create-form").addEventListener("submit", (event) => {
    void submitFileCreation(event as SubmitEvent);
  });
  $("#file-create-cancel").addEventListener("click", cancelFileCreation);
  $("#file-create-name").addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelFileCreation();
    }
  });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || event.target.closest(".tree-actions")) return;
    for (const menu of document.querySelectorAll<HTMLDetailsElement>(".tree-actions")) menu.open = false;
  });
  $("#file-tree-refresh").addEventListener("click", () => {
    dirCache.clear();
    expandedDirs.clear();
    void loadWorkspaceTree();
  });
  void loadWorkspaceTree();
}

// ---------------------------------------------------------------------------
// Experiments — the human's experimental designs, run through Loom.
// Arms run as real weave calls in the current work session; an arm's result
// is only ever the reply text a real run returned.
// ---------------------------------------------------------------------------

function replaceExperiment(updated: Experiment) {
  experiments = experiments.map((e) => (e.id === updated.id ? updated : e));
}

function expStatusLabel(e: Experiment): string {
  if (e.status === "running") return "Running";
  if (e.status === "decided") return "Decided";
  return "Draft";
}

function selectExperiment(id: string | null) {
  selectedExperimentId = id;
  renderExperiments();
}

function renderExperiments() {
  withFocusRestore(() => {
    const list = $("#exp-list");
    list.innerHTML = "";
    if (experiments.length === 0) {
      const empty = document.createElement("li");
      empty.className = "exp-empty";
      empty.textContent = "No experiments yet. Use New experiment to begin.";
      list.append(empty);
    } else {
      for (const e of experiments) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "exp-row" + (e.id === selectedExperimentId ? " selected" : "");
        if (e.id === selectedExperimentId) {
          btn.setAttribute("aria-current", "true");
        }
        const title = document.createElement("span");
        title.className = "exp-row-title";
        title.textContent = e.title;
        const status = document.createElement("span");
        status.className = `exp-status ${e.status}`;
        status.textContent = expStatusLabel(e);
        btn.append(title, status);
        btn.addEventListener("click", () => selectExperiment(e.id));
        li.append(btn);
        list.append(li);
      }
    }
    renderExperimentDetail();
  });
}

function expField(label: string, text: string): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "exp-field";
  const h = document.createElement("h4");
  h.className = "exp-sub";
  h.textContent = label;
  const p = document.createElement("p");
  p.textContent = text;
  sec.append(h, p);
  return sec;
}

function renderExperimentDetail() {
  const wrap = $("#exp-detail");
  wrap.innerHTML = "";
  const exp = experiments.find((e) => e.id === selectedExperimentId);
  if (!exp) {
    const empty = document.createElement("div");
    empty.className = "exp-detail-empty";
    const text = document.createElement("p");
    text.textContent =
      "No experiment selected. Create an experiment to state a question, define arms, and compare real results.";
    empty.append(text);
    wrap.append(empty);
    return;
  }

  const head = document.createElement("div");
  head.className = "exp-head";
  const title = document.createElement("h3");
  title.textContent = exp.title;
  const status = document.createElement("span");
  status.className = `exp-status ${exp.status}`;
  status.textContent = expStatusLabel(exp);
  head.append(title, status);
  wrap.append(head);

  wrap.append(expField("Question", exp.question || "Not stated yet."));
  wrap.append(expField("Hypothesis", exp.hypothesis || "Not stated yet."));

  const armsTitle = document.createElement("h4");
  armsTitle.className = "exp-sub";
  armsTitle.textContent = "Arms";
  wrap.append(armsTitle);
  if (exp.arms.length === 0) {
    const none = document.createElement("p");
    none.className = "empty";
    none.textContent = "No arms yet. An arm is one configuration to test.";
    wrap.append(none);
  } else {
    for (const arm of exp.arms) {
      wrap.append(buildArmRow(exp, arm));
    }
  }

  wrap.append(buildAddArmForm(exp));

  // Side-by-side comparison of arms that have run — so the human sees
  // alternatives, not a single recommendation (P4 Human Creativity).
  const doneArms = exp.arms.filter((a) => a.status === "done");
  if (doneArms.length >= 2) {
    wrap.append(buildArmComparison(doneArms));
  }

  if (exp.decision) {
    const decided = exp.arms.find((a) => a.id === exp.decision);
    const dec = document.createElement("div");
    dec.className = "exp-decision decided";
    const label = document.createElement("strong");
    label.textContent = `Decision: ${decided?.label ?? exp.decision}`;
    dec.append(label);
    const change = document.createElement("button");
    change.type = "button";
    change.className = "btn ghost";
    change.textContent = "Change decision";
    change.addEventListener("click", () => clearExperimentDecisionHandler(exp.id));
    dec.append(change);
    wrap.append(dec);
  } else if (doneArms.length >= 2) {
    const dec = document.createElement("div");
    dec.className = "exp-decision";
    const label = document.createElement("strong");
    label.textContent = "Decision required — choose a configuration";
    dec.append(label);
    const row = document.createElement("div");
    row.className = "exp-decision-options";
    for (const arm of doneArms) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = `Choose ${arm.label}`;
      btn.addEventListener("click", () => decideExperiment(exp.id, arm.id));
      row.append(btn);
    }
    dec.append(row);
    wrap.append(dec);
  }
}

function buildArmRow(exp: Experiment, arm: ExperimentArm): HTMLElement {
  const row = document.createElement("div");
  row.className = "arm-row";
  const head = document.createElement("div");
  head.className = "arm-head";
  const label = document.createElement("strong");
  label.textContent = arm.label;
  const status = document.createElement("span");
  status.className = `exp-status ${arm.status}`;
  status.textContent =
    arm.status === "defined" ? "Defined" : arm.status === "running" ? "Running…" : "Done";
  head.append(label, status);
  row.append(head);

  if (arm.config) {
    const cfg = document.createElement("p");
    cfg.className = "arm-config";
    cfg.textContent = arm.config;
    row.append(cfg);
  }

  if (arm.result) {
    const result = document.createElement("pre");
    result.className = "arm-result";
    result.textContent = arm.result;
    row.append(result);
  }

  const actions = document.createElement("div");
  actions.className = "arm-actions";
  const run = document.createElement("button");
  run.type = "button";
  run.className = "btn";
  run.textContent = arm.status === "done" ? "Run again" : "Run arm";
  run.disabled = !loomReachable || arm.status === "running";
  run.title = loomReachable
    ? "Runs this arm as a real Loom request in the current session."
    : "The Loom server is offline — an arm run needs it.";
  run.addEventListener("click", () => runExperimentArm(exp, arm));
  actions.append(run);
  if (arm.status === "running") {
    // Escape hatch for an arm stuck mid-run (e.g. the app closed while
    // it was running and the revert never landed).
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn ghost";
    reset.textContent = "Reset";
    reset.title = "Mark this arm as not running so it can run again.";
    reset.addEventListener("click", async () => {
      try {
        const updated = await setExperimentArmStatus(exp.id, arm.id, "defined");
        replaceExperiment(updated);
        renderExperiments();
      } catch (err) {
        addChatError(
          `Could not reset the arm: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    actions.append(reset);
  }
  row.append(actions);
  return row;
}

/** Side-by-side comparison of arms that have run. The human sees each
    arm's configuration and result together, with differences highlighted,
    so the choice is an informed comparison — not a single recommendation
    (P4 Human Creativity). */
function buildArmComparison(arms: ExperimentArm[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const head = document.createElement("div");
  head.className = "wd-section-head";
  const h = document.createElement("h4");
  h.textContent = "Compare arms";
  head.append(h);
  section.append(head);

  const grid = document.createElement("div");
  grid.className = "arm-comparison";
  grid.style.setProperty("--comp-cols", String(arms.length));

  // Header row: arm labels.
  const header = document.createElement("div");
  header.className = "comp-row";
  const empty = document.createElement("span");
  empty.className = "comp-cell comp-label";
  header.append(empty);
  for (const arm of arms) {
    const cell = document.createElement("span");
    cell.className = "comp-cell";
    const label = document.createElement("strong");
    label.textContent = arm.label;
    cell.append(label);
    header.append(cell);
  }
  grid.append(header);

  // Config row.
  const cfgRow = document.createElement("div");
  cfgRow.className = "comp-row";
  const cfgLabel = document.createElement("span");
  cfgLabel.className = "comp-cell comp-label";
  cfgLabel.textContent = "Configuration";
  cfgRow.append(cfgLabel);
  for (const arm of arms) {
    const cell = document.createElement("span");
    cell.className = "comp-cell";
    cell.textContent = arm.config || "—";
    cell.title = arm.config || "No configuration recorded";
    cfgRow.append(cell);
  }
  grid.append(cfgRow);

  // Result row: one cell per arm, so the results sit side by side under
  // their arm labels. Results are shown verbatim — the human judges,
  // not the UI. (The "diff hint" note in the old comment was never
  // implemented; it stays out.)
  const resultRow = document.createElement("div");
  resultRow.className = "comp-row";
  const resultLabel = document.createElement("span");
  resultLabel.className = "comp-cell comp-label";
  resultLabel.textContent = "Result";
  resultRow.append(resultLabel);
  for (const arm of arms) {
    const cell = document.createElement("span");
    cell.className = "comp-cell";
    const pre = document.createElement("pre");
    pre.className = "arm-result comp-result";
    pre.textContent = arm.result || "(no result recorded)";
    cell.append(pre);
    resultRow.append(cell);
  }
  grid.append(resultRow);

  section.append(grid);
  return section;
}

function buildAddArmForm(exp: Experiment): HTMLElement {
  const form = document.createElement("form");
  form.className = "add-arm";
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Arm label (e.g. Baseline)";
  labelInput.setAttribute("aria-label", "Arm label");
  const cfgInput = document.createElement("input");
  cfgInput.type = "text";
  cfgInput.placeholder = "What makes it different (e.g. memory off)";
  cfgInput.setAttribute("aria-label", "Arm configuration");
  const add = document.createElement("button");
  add.type = "submit";
  add.className = "btn ghost";
  add.textContent = "Add arm";
  form.append(labelInput, cfgInput, add);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = labelInput.value.trim();
    if (!label) return;
    try {
      const updated = await addExperimentArm(exp.id, label, cfgInput.value);
      replaceExperiment(updated);
      renderExperiments();
    } catch (err) {
      addChatError(
        `Could not add the arm: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
  return form;
}

function openNewExperimentForm() {
  const wrap = $("#exp-detail");
  wrap.innerHTML = "";
  const form = document.createElement("form");
  form.className = "new-exp";
  const heading = document.createElement("h3");
  heading.textContent = "New experiment";
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Title (e.g. Memory latency)";
  titleInput.setAttribute("aria-label", "Experiment title");
  const questionInput = document.createElement("textarea");
  questionInput.rows = 2;
  questionInput.placeholder =
    "Question (e.g. Why does enabling agent memory increase latency?)";
  questionInput.setAttribute("aria-label", "Experiment question");
  const hypothesisInput = document.createElement("textarea");
  hypothesisInput.rows = 2;
  hypothesisInput.placeholder = "Hypothesis (your best guess)";
  hypothesisInput.setAttribute("aria-label", "Experiment hypothesis");
  const create = document.createElement("button");
  create.type = "submit";
  create.className = "btn";
  create.textContent = "Create experiment";
  form.append(heading, titleInput, questionInput, hypothesisInput, create);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    try {
      const created = await addExperiment(
        title,
        questionInput.value,
        hypothesisInput.value,
      );
      experiments = [created, ...experiments];
      selectedExperimentId = created.id;
      refreshSpatialVault();
      renderExperiments();
    } catch (err) {
      addChatError(
        `Could not create the experiment: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });
  wrap.append(form);
}

async function decideExperiment(expId: string, armId: string) {
  try {
    const updated = await chooseExperimentArm(expId, armId);
    replaceExperiment(updated);
    renderExperiments();
    await refreshAttention();
    setSphereState("attention");
    window.setTimeout(() => {
      if (sphereState === "attention") setSphereState("idle");
    }, 3000);
  } catch (err) {
    addChatError(
      `Could not record the decision: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Revoke a recorded decision so the experiment can be decided again. */
async function clearExperimentDecisionHandler(expId: string) {
  try {
    const updated = await clearExperimentDecision(expId);
    replaceExperiment(updated);
    renderExperiments();
    await refreshAttention();
  } catch (err) {
    addChatError(
      `Could not change the decision: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Run one arm as a real Loom request in the current session. */
async function runExperimentArm(exp: Experiment, arm: ExperimentArm) {
  if (!loomReachable) {
    addChatError("The Loom server is offline — an arm run needs it.");
    return;
  }
  // Capture the work at send time: the reply (and the session link) belong
  // to the work the run was started from, even if the user switches work
  // while it is in flight.
  const workId = selectedWorkId;
  const cacheKey = workId ?? UNASSIGNED_KEY;
  try {
    const running = await setExperimentArmStatus(exp.id, arm.id, "running");
    replaceExperiment(running);
    renderExperiments();
  } catch (err) {
    addChatError(
      `Could not start the arm: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  const prompt = [
    `Experiment: ${exp.title}`,
    `Question: ${exp.question || "(not stated)"}`,
    `Hypothesis: ${exp.hypothesis || "(not stated)"}`,
    `Run this arm and report its results: ${arm.label}${arm.config ? ` — ${arm.config}` : ""}`,
  ].join("\n");

  addChatMessage("user", `Run experiment arm: ${arm.label}`);
  cacheChatMessage(cacheKey, "user", `Run experiment arm: ${arm.label}`);
  if (workId) experimentWorkIds.set(exp.id, workId);
  setSphereState("executing");
  const log = $("#chat-log");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "Loom is running the arm…";
  log.append(typing);
  log.scrollTop = log.scrollHeight;

  try {
    const reply = await askLoom(
      prompt,
      selectedSessionId ?? undefined,
      selectedAgentId ?? undefined,
    );
    typing.remove();
    loomVerified = true;
    setLoomReachable(true);
    // Append to the visible log only if this work is still selected; the
    // reply is always cached under the work the run was started from.
    if (selectedWorkId === workId) {
      addChatMessage("loom", reply.text, reply);
    }
    cacheChatMessage(cacheKey, "loom", reply.text);
    await refreshAgents();
    // Adopt the session the server reports (it may have auto-created one)
    // and link it to the work the run was started from.
    if (reply.session_id) {
      if (!sessions.some((s) => s.id === reply.session_id)) {
        await refreshSessions();
      }
      if (workId) {
        try {
          const linked = await setWorkSession(workId, reply.session_id);
          workItems = workItems.map((w) => (w.id === linked.id ? linked : w));
          renderWorkList();
          if (selectedWorkId === workId) {
            selectedSessionId = reply.session_id;
            renderSessionBar();
            void loadWorkArtifacts(workId);
          }
        } catch {
          /* link is best-effort */
        }
      } else if (selectedWorkId === workId) {
        selectedSessionId = reply.session_id;
        renderSessionBar();
      }
    }
    const done = await setExperimentArmResult(exp.id, arm.id, reply.text);
    replaceExperiment(done);
    renderExperiments();
    await refreshAttention();
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    typing.remove();
    if (isLoomConnectionError(err)) setLoomReachable(false);
    try {
      const reverted = await setExperimentArmStatus(exp.id, arm.id, "defined");
      replaceExperiment(reverted);
      renderExperiments();
    } catch {
      /* leave as is */
    }
    addChatError(
      `The arm run failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    setSphereState("error");
  }
}

// ---------------------------------------------------------------------------
// Application menus and workspace modes
// ---------------------------------------------------------------------------

const ALL_VIEWS: Mode[] = [
  "spatial",
  "experiment",
  "work",
  "code",
  "agents",
  "evidence",
  "artifacts",
  "knowledge",
];

let appMenu: ReturnType<typeof installAppMenu> | null = null;

function initAppMenu() {
  const guide = $("#app-help-dialog") as HTMLDialogElement;
  $("#app-help-close").addEventListener("click", () => guide.close());
  appMenu = installAppMenu($("#app-menu"), [
    {
      label: "File",
      items: [
        { label: "New file…", disabled: () => fileCreationPending || folderOpening || !workspaceInfo,
          run: () => { setMode("code"); beginFileCreation("file"); } },
        { label: "New folder…", disabled: () => fileCreationPending || folderOpening || !workspaceInfo,
          run: () => { setMode("code"); beginFileCreation("folder"); } },
        "separator",
        { label: "Open folder…", disabled: () => !isTauri || folderOpening || fileCreationPending, run: showFolderDialog },
        { label: "Save", disabled: () => mode !== "code" || (!openFilePath && !currentNote),
          run: async () => { await saveNote(); } },
        { label: "Reload file", disabled: () => !openFilePath || Boolean(saveInFlight), run: reloadFile },
        { label: "Close file", disabled: () => !openFilePath && !currentNote, run: closeFile },
        ...NOTE_DOCS.filter((note) => hasPreviousNote(note.kind)).map((note) => ({ label: note.title, run: () => openNote(note.kind) })),
      ],
    },
    {
      label: "Edit",
      items: [
        ...textEditingActions(),
        "separator",
        { label: "Find work and notes…", run: openGlobalSearch },
      ],
    },
    {
      label: "View",
      items: [
        ...(["code", "experiment", "work", "agents", "evidence", "knowledge"] as const).map((view) => ({
          label: view[0].toUpperCase() + view.slice(1),
          radio: true,
          checked: () => mode === view,
          run: () => setMode(view),
        })),
        "separator",
        { label: "Work panel", disabled: () => !isLeftDrawer() && mode !== "work" && mode !== "experiment",
          checked: () => !isLeftDrawer() ? (mode === "work" || mode === "experiment") : document.body.classList.contains("left-open"),
          run: () => {
            if (isLeftDrawer()) {
              if (document.body.classList.contains("left-open")) closeLeftDrawer();
              else openLeftDrawer();
            } else if (mode !== "work" && mode !== "experiment") {
              setMode("work");
            }
          } },
        { label: "Context panel", checked: () => rightOpen && rightTab === "context",
          run: () => {
            if (rightOpen && rightTab === "context") closeRight();
            else openRight("context");
          } },
        { label: "Conversation", checked: () => rightOpen && rightTab === "conversation",
          run: () => {
            if (rightOpen && rightTab === "conversation") closeRight();
            else focusChat();
          } },
        "separator",
        // Appearance lives here now, not in the header (audit D7): the
        // header keeps one panel toggle, and the menu is the single
        // place for the Dark/White choice.
        { label: "Dark", radio: true, checked: () => getAppearance() === "dark",
          run: () => setAppearance("dark") },
        { label: "White", radio: true, checked: () => getAppearance() === "white",
          run: () => setAppearance("white") },
        "separator",
        ...LAYERS.map((layer) => ({
          label: layer.label,
          description: layer.desc,
          checked: () => layerOn[layer.id],
          run: () => {
            layerOn[layer.id] = !layerOn[layer.id];
            applyLayerClasses();
            saveLayers();
          },
        })),
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Using Loom", run: () => guide.showModal() },
        { label: "About Loom", run: () => {
          guide.showModal();
          $("#app-help-about").scrollIntoView({ block: "nearest" });
        } },
      ],
    },
  ]);
}

function closeMenus() {
  appMenu?.close();
  setChatMenu(false);
}

/** Open/close the chat menu, keeping aria-expanded in sync. */
function setChatMenu(open: boolean) {
  const chatMenu = $("#chat-menu");
  if (chatMenu) chatMenu.hidden = !open;
  $("#chat-menu-btn").setAttribute("aria-expanded", String(open));
}

function currentLoomState(): SphereState {
  const attention = knowledgeFailed || (loomStatusKnown && !loomReachable) || sphereState === "error" ? "error"
    : pendingKnowledge > 0 || attentionItems.length > 0 || sphereState === "attention" ? "attention" : null;
  return loomState(attention, chatInFlight > 0,
    Boolean(runningWorkflow) || experiments.some(e => e.arms.some(a => a.status === "running")),
    document.querySelector<HTMLInputElement>("#chat-text")?.value ?? "", sphereState === "completed");
}

function renderStatusPill() {
  const pill = $("#loom-status");
  const text = $("#loom-status-text");
  if (!loomStatusKnown) {
    text.textContent = "Checking Loom…";
    pill.classList.remove("live");
    pill.title = "Checking whether the Loom server answers on localhost:5006.";
  } else if (loomVerified) {
    text.textContent = "Connected to Loom";
    pill.classList.add("live");
    pill.title = "A verified Loom response was received from localhost:5006.";
  } else if (loomReachable) {
    text.textContent = "Server reachable";
    pill.classList.remove("live");
    pill.title =
      "The Loom server answers on localhost:5006, but no Loom-level response has been verified yet.";
  } else {
    text.textContent = "Loom offline";
    pill.classList.remove("live");
    pill.title =
      "The Loom server is not reachable at localhost:5006. Start the server to connect.";
  }
  const state = currentLoomState();
  pill.title += ` ${CAPTIONS[state]}`;
  pill.dataset.state = state;
  notifySpatialState(state);
}

function setMode(next: Mode) {
  if (mode === next) {
    closeMenus();
    return;
  }
  if (document.body.classList.contains("left-open")) closeLeftDrawer(false);
  closeKnowledgeDrawer(false);
  if (mode === "spatial") spatialPane = { tab: rightTab, open: rightOpen };
  else otherPane = { tab: rightTab, open: rightOpen };
  const previousDrawer = isRightDrawer();
  const pane = next === "spatial" ? spatialPane : mode === "spatial" ? otherPane : { tab: rightTab, open: rightOpen };
  mode = next;
  rightTab = pane.tab;
  rightOpen = isRightDrawer() && !previousDrawer ? false : pane.open;
  rightWasDrawer = isRightDrawer();
  $("#spatial-knowledge").hidden = next !== "spatial";
  const search = document.querySelector<HTMLElement>(".search-wrap");
  if (search) $(next === "knowledge" ? "#knowledge-search-slot" : "#work-search-slot").append(search);
  if (next === "knowledge" || next === "spatial") { void knowledge?.refresh(); }
  // Keep the footer destination and its accessible state synchronized.
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".mode-btn")) {
    const active = btn.dataset.mode === next;
    btn.classList.toggle("active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  }
  for (const id of ALL_VIEWS) {
    const el = document.getElementById(`view-${id}`);
    if (el) el.hidden = id !== next;
  }
  for (const cls of ["code", "experiment", "work", "agents", "evidence", "artifacts", "knowledge"]) {
    document.body.classList.toggle(`mode-${cls}`, cls === next);
  }
  // The scene follows the mode: water + full atmosphere only in Experiment.
  document.querySelector(".scene")?.setAttribute("data-mode", next);
  applyRightPane();
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest("[hidden]") || (active?.closest("#right-col") && !rightOpen)) {
    document.querySelector<HTMLElement>(`.mode-btn[data-mode="${next}"]`)?.focus();
  }
  closeMenus();
}

// ---------------------------------------------------------------------------
// File canvas. Legacy local notes are available only when they contain saved text.
// ---------------------------------------------------------------------------

const NOTE_KEY_DESIGN = "loom-ide-tauri:design-note";
const NOTE_KEY_SCRATCH = "loom-ide-tauri:scratch-note";

function noteKey(kind: NoteKind): string {
  return kind === "design" ? NOTE_KEY_DESIGN : NOTE_KEY_SCRATCH;
}

function hasPreviousNote(kind: NoteKind) {
  try { return Boolean(localStorage.getItem(noteKey(kind))?.trim()); }
  catch { return false; }
}

function showEditorError(error: unknown) {
  const element = $("#code-error");
  element.textContent = error instanceof Error ? error.message : String(error);
  element.hidden = false;
}

function renderEditor() {
  const opened = openFilePath !== null || currentNote !== null;
  $("#canvas-empty").hidden = opened;
  $("#code-editor").hidden = !opened;
  $("#code-foot").hidden = !opened;
  const tabs = $("#code-tabs");
  tabs.hidden = !opened;
  tabs.replaceChildren();
  if (opened) {
    const title = document.createElement("span");
    title.id = "open-file-title";
    title.className = "code-tab active";
    title.textContent = openFilePath ? workspaceLabel(openFilePath) : NOTE_DOCS.find((note) => note.kind === currentNote)!.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn small";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close file");
    close.addEventListener("click", () => { void closeFile(); });
    tabs.append(title, close);
  }
  $("#code-path").hidden = true;
}

function markEditorDirty() {
  const title = document.getElementById("open-file-title");
  if (title) {
    const name = openFilePath ? workspaceLabel(openFilePath) : NOTE_DOCS.find((note) => note.kind === currentNote)?.title;
    const dirty = openFilePath !== null && ($("#code-editor") as HTMLTextAreaElement).value !== openFileOriginal;
    title.textContent = `${name ?? ""}${dirty ? " •" : ""}`;
  }
}

function clearEditor() {
  openFilePath = null;
  openFileOriginal = null;
  currentNote = null;
  ($("#code-editor") as HTMLTextAreaElement).value = "";
  $("#code-error").hidden = true;
  $("#code-saved").hidden = true;
  renderEditor();
  renderFileTree();
}

async function closeFile() {
  if (await saveNote()) { ++documentRequest; clearEditor(); }
}

function saveNote(): Promise<boolean> {
  if (saveInFlight) return saveInFlight;
  const editor = $("#code-editor") as HTMLTextAreaElement;
  if (!openFilePath && !currentNote) return Promise.resolve(true);
  if (openFilePath && editor.value === openFileOriginal) return Promise.resolve(true);
  const path = openFilePath;
  const content = editor.value;
  const original = openFileOriginal;
  const kind = currentNote;
  const button = $("#code-save") as HTMLButtonElement;
  editor.readOnly = true;
  button.disabled = true;
  button.textContent = "Saving…";
  saveInFlight = (async () => {
    try {
      if (path && original !== null) {
        await writeFile(path, content, original);
        openFileOriginal = content;
        markEditorDirty();
      } else if (kind) localStorage.setItem(noteKey(kind), content);
      $("#code-error").hidden = true;
      $("#code-saved").hidden = false;
      return true;
    } catch (error) {
      showEditorError(error);
      return false;
    } finally {
      editor.readOnly = false;
      button.disabled = false;
      button.textContent = "Save";
    }
  })();
  return saveInFlight.finally(() => { saveInFlight = null; });
}

async function openNote(kind: NoteKind) {
  if (!await saveNote()) return;
  ++documentRequest;
  currentNote = kind;
  openFilePath = null;
  openFileOriginal = null;
  ($("#code-editor") as HTMLTextAreaElement).value = localStorage.getItem(noteKey(kind)) ?? "";
  renderEditor();
  setMode("code");
}

async function reloadFile() {
  if (!openFilePath || saveInFlight) return;
  const path = openFilePath;
  const editor = $("#code-editor") as HTMLTextAreaElement;
  if (editor.value !== openFileOriginal && !window.confirm("Discard your unsaved changes and reload this file?")) return;
  const request = ++documentRequest;
  try {
    const content = await readFile(path);
    if (request !== documentRequest || openFilePath !== path) return;
    editor.value = content;
    openFileOriginal = content;
    markEditorDirty();
    $("#code-error").hidden = true;
    $("#code-saved").hidden = true;
  } catch (error) { showEditorError(error); }
}

function initCodeEditor() {
  clearEditor();
  $("#code-editor").addEventListener("input", () => {
    $("#code-saved").hidden = true;
    markEditorDirty();
  });
  window.addEventListener("beforeunload", (event) => {
    if (openFilePath && ($("#code-editor") as HTMLTextAreaElement).value !== openFileOriginal) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  $("#code-save").addEventListener("click", () => { void saveNote(); });
  $("#code-ask").addEventListener("click", async () => {
    const editor = $("#code-editor") as HTMLTextAreaElement;
    focusChat();
    await sendChat(`About this text: ${editor.value.slice(0, 280)}`);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  loadLayers();
  applyLayerClasses();
  rightOpen = !isRightDrawer();
  rightWasDrawer = isRightDrawer();
  applyRightPane();
  initAppMenu();
  // Initialize local views before any Loom requests finish.
  initCodeEditor();
  initWorkspaceExplorer();
  knowledge = installKnowledge(() => setMode("knowledge"), (count, failed) => { pendingKnowledge = count; knowledgeFailed = failed; renderStatusPill(); });
  installSpatialWorkbench((object) => {
    switch (object) {
      case "Work": setMode("work"); break;
      case "Code": setMode("code"); break;
      case "Experiments": setMode("experiment"); break;
      case "Evidence": setMode("evidence"); break;
      case "Agents": setMode("agents"); break;
      case "Notes": setMode("knowledge"); break;
      default: break;
    }
  }, () => ({ work: workItems.length, experiments: experiments.length }), currentLoomState);
  // The footer provides the primary mode navigation.
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".mode-btn")) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode as Mode));
  }
  // Right pane tabs.
  $("#tab-context").addEventListener("click", () => {
    selectRightTab("context");
  });
  $("#tab-conversation").addEventListener("click", () => selectRightTab("conversation"));
  $("#right-col")?.addEventListener("keydown", (e) => {
    const event = e as KeyboardEvent;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target as HTMLElement;
    if (!target.closest(".inspector-tabs")) return;
    event.preventDefault();
    selectRightTab(rightTab === "context" ? "conversation" : "context");
    document
      .getElementById(rightTab === "context" ? "tab-context" : "tab-conversation")
      ?.focus();
  });
  // Artifact tabs.
  for (const tab of document.querySelectorAll<HTMLButtonElement>("#artifact-tabs .tab")) {
    tab.addEventListener("click", () => {
      setArtifactTab(tab.dataset.atab as "artifacts" | "documents");
    });
  }
  // Artifact search (server-side, via search_artifacts; debounced).
  const artifactSearch = document.querySelector<HTMLInputElement>("#artifact-search");
  artifactSearch?.addEventListener("input", () => {
    window.clearTimeout(artifactSearchTimer);
    artifactSearchTimer = window.setTimeout(() => {
      void searchArtifactsView(artifactSearch.value);
    }, 300);
  });
  // Clicking anywhere else closes the popover menus.
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest("#chat-menu") && !target.closest("#chat-menu-btn")) {
      const chatMenu = $("#chat-menu");
      if (chatMenu && !chatMenu.hidden) setChatMenu(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (knowledge?.isDialogOpen()) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); openGlobalSearch(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); void knowledge?.newNote(); return; }
    if (e.key === "Escape") {
      if (document.getElementById("decision-dialog-overlay")) return; // handled by its trap
      if (
        document.body.classList.contains("knowledge-open") ||
        document.body.classList.contains("left-open") ||
        (isRightDrawer() && document.body.classList.contains("right-open"))
      ) {
        closeDrawers();
      } else if (!($("#search-input") as HTMLInputElement).hidden) {
        setSearchOpen(false);
        ($("#search-btn") as HTMLButtonElement).focus();
      } else {
        closeMenus();
      }
      return;
    }
    // Focus trap for the modal drawers: Tab cycles within the open pane
    // instead of moving into the page behind the scrim.
    if (e.key === "Tab") {
      const openDrawer = document.body.classList.contains("knowledge-open")
        ? $("#spatial-knowledge")
        : document.body.classList.contains("left-open")
        ? $("#left-col")
        : isRightDrawer() && document.body.classList.contains("right-open")
          ? $("#right-col")
          : null;
      if (!openDrawer) return;
      const focusables = [...openDrawer.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      )].filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Header: the objective banner opens the selected work in the Work view.
  $("#objective-btn").addEventListener("click", () => setMode("work"));

  $("#chat-toggle").addEventListener("click", (e) => {
    if (rightOpen && rightTab === "conversation") closeRight();
    else openRight("conversation", e.currentTarget as HTMLElement);
  });
  $("#spatial-knowledge").hidden = mode !== "spatial";
  $("#spatial-knowledge-toggle").addEventListener("click", e => {
    if (document.body.classList.contains("knowledge-open")) { closeKnowledgeDrawer(); return; }
    if (rightOpen && isRightDrawer()) closeRight(false);
    closeLeftDrawer(false);
    knowledgeOpener = e.currentTarget as HTMLElement;
    document.body.classList.add("knowledge-open");
    knowledgeOpener.setAttribute("aria-expanded", "true");
    updateScrim();
    $("#spatial-knowledge-close").focus();
  });
  $("#spatial-knowledge-close").addEventListener("click", () => closeKnowledgeDrawer());
  $("#left-close").addEventListener("click", () => closeLeftDrawer());
  $("#right-close").addEventListener("click", () => closeRight());
  $("#scrim").addEventListener("click", () => closeDrawers());
  window.addEventListener("resize", () => {
    if (!isLeftDrawer()) {
      document.body.classList.remove("left-open"); closeKnowledgeDrawer(false);
      if (document.activeElement?.id === "spatial-knowledge-close") $("#spatial-open-full").focus();
    } else if (mode === "spatial" && !document.body.classList.contains("knowledge-open") && $("#spatial-knowledge").contains(document.activeElement)) {
      $("#spatial-knowledge-toggle").focus();
    }
    const nowDrawer = isRightDrawer();
    if (nowDrawer !== rightWasDrawer) {
      // Crossing into drawer widths must not turn the persistent column into
      // an unrequested modal. Crossing back restores the desktop column, whose
      // default state is open.
      rightOpen = !nowDrawer;
      rightWasDrawer = nowDrawer;
      if (!rightOpen && document.querySelector("#right-col")?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
    }
    applyRightPane();
  });

  // Search: filters the work catalogue by title.
  $("#search-btn").addEventListener("click", () => {
    const input = $("#search-input") as HTMLInputElement;
    setSearchOpen(Boolean(input.hidden));
  });
  $("#search-input").addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const query = ($("#search-input") as HTMLInputElement).value.trim();
    if (!query) return;
    const first = knowledge?.searchResults(query)[0];
    if (first) { e.preventDefault(); void knowledge?.openNote(first.meta.id); }
  });
  $("#search-input").addEventListener("input", (e) => {
    applySearchFilter((e.target as HTMLInputElement).value);
  });

  // Chat menu: clear the conversation.
  $("#chat-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#chat-menu");
    setChatMenu(!menu.hidden);
  });
  $("#chat-clear").addEventListener("click", () => {
    const log = $("#chat-log");
    log.innerHTML = "";
    showChatHint();
    chatCache.delete(selectedWorkId ?? UNASSIGNED_KEY);
    saveChatCache();
    closeMenus();
  });

  // Work: the intent header is already in the left catalogue, above the
  // work list (index.html). It renders from the same state as the detail.
  await refreshIntents();
  workItems = await getWorkItems();
  selectedWorkId = workItems[0]?.id ?? null;
  renderWorkList();
  renderWorkDetail();
  renderChatScope();
  // The one work creation form links to the active intent and, when online, a Loom session.
  async function createWorkItemFromTitle(title: string): Promise<void> {
    try {
      const item = await addWorkItem(title, activeIntentId);
      workItems = [item, ...workItems];
      refreshSpatialVault();
      ($("#new-work-input") as HTMLInputElement).value = "";
      // The backend may have auto-created a one-line intent for this
      // work when no intent was active; pick it up in the header.
      await refreshIntents();
      // Give the new work its own Loom session when the server is up.
      if (loomReachable) {
        try {
          const created = await createSession(title, selectedAgentId ?? undefined);
          sessions = [created, ...sessions.filter((s) => s.id !== created.id)];
          const linked = await setWorkSession(item.id, created.id);
          workItems = workItems.map((w) => (w.id === linked.id ? linked : w));
        } catch {
          // The work item still exists; the session is best-effort.
        }
      }
      selectWork(item.id);
    } catch (err) {
      // Inline error on the form itself; the list keeps its state.
      const form = $("#new-work-form");
      let errEl = form.querySelector<HTMLElement>(".field-error");
      if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "field-error";
        form.append(errEl);
      }
      showFieldError(errEl, `Could not create the work item: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  $("#new-work-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#new-work-input") as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;
    await createWorkItemFromTitle(title);
  });

  // Attention (local experiments waiting
  // for a decision). The status probe runs first so the first paint does
  // not flash "offline" while the server is actually up.
  try {
    const status = await getLoomStatus();
    setLoomReachable(status.online);
  } catch {
    setLoomReachable(false);
  }
  attentionItems = await getAttention();
  renderInspectorContext();

  // New Loom data: expose more of the server's API (honest empty when offline).
  try {
    await Promise.all([
      refreshTools(),
      refreshModels(),
      refreshProviders(),
      refreshArtifactStats(),
      refreshServerConfig(),
      refreshStorageStatus(),
    ]);
  } catch {
    /* individual failures are handled inside each refresh function */
  }

  // Workspace views.
  renderAgents();
  renderEvidence();
  renderArtifacts();

  // Experiments (local definitions; arms run through real Loom calls).
  try {
    experiments = await getExperiments();
  } catch {
    experiments = [];
  }
  selectedExperimentId = experiments[0]?.id ?? null;
  renderExperiments();
  $("#exp-new").addEventListener("click", () => openNewExperimentForm());

  // Workflows + artifacts (real Loom server; honest empty when offline).
  try {
    workflows = await listWorkflows();
    setLoomReachable(true);
  } catch (err) {
    workflows = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  try {
    executions = await listWorkflowExecutions();
    setLoomReachable(true);
  } catch (err) {
    executions = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  try {
    artifacts = await listArtifacts();
    setLoomReachable(true);
  } catch (err) {
    artifacts = [];
    if (isLoomConnectionError(err)) setLoomReachable(false);
  }
  renderWorkDetail();
  if (selectedWorkId) void loadWorkArtifacts(selectedWorkId);

  // Sessions + agents (from the Loom server). The selected work item's
  // session is the source of truth for the conversation; switch to it.
  await refreshAgents();
  await refreshSessions();
  loadChatCache();
  syncSessionToWork();
  // Restore the saved session/agent selection when no work item supplies
  // one (the keys were previously written but never read back).
  if (!selectedSessionId) {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession && sessions.some((s) => s.id === savedSession)) {
      selectedSessionId = savedSession;
      renderSessionBar();
      loadChatForWork(selectedWorkId, savedSession);
    }
  }
  if (!selectedAgentId) {
    const savedAgent = localStorage.getItem(AGENT_KEY);
    if (savedAgent && agents.some((a) => (a.name || a.id) === savedAgent)) {
      selectedAgentId = savedAgent;
      renderAgentBar();
    }
  }

  $("#session-select").addEventListener("change", async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    selectedSessionId = v || null;
    if (v) localStorage.setItem(SESSION_KEY, v);
    else localStorage.removeItem(SESSION_KEY);
    // Keep the work item linked to the chosen session.
    if (selectedWorkId) {
      try {
        const updated = await setWorkSession(selectedWorkId, v || null);
        workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
        renderWorkList();
      } catch {
        /* link is best-effort */
      }
      void loadWorkArtifacts(selectedWorkId);
    }
    // Cache-first: the work's cached conversation survives a session
    // change, and the log is only replaced once the history fetch succeeds.
    if (v) {
      loadChatForWork(selectedWorkId, v);
      void refreshSessionDetail(v);
      void ensureSessionSubscription();
    } else {
      clearChat();
      sessionDetail = null;
      renderInspectorContext();
      sessionSubId = null;
    }
  });
  $("#agent-select").addEventListener("change", async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    selectedAgentId = v || null;
    if (v) localStorage.setItem(AGENT_KEY, v);
    else localStorage.removeItem(AGENT_KEY);
    if (v) void refreshAgentDetail(v);
    else {
      selectedAgentDetail = null;
      renderInspectorContext();
    }
  });
  $("#session-new").addEventListener("click", async () => {
    try {
      const created = await createSession(undefined, selectedAgentId ?? undefined);
      sessions = [created, ...sessions.filter((s) => s.id !== created.id)];
      selectedSessionId = created.id;
      localStorage.setItem(SESSION_KEY, created.id);
      renderSessionBar();
      if (selectedWorkId) {
        try {
          const updated = await setWorkSession(selectedWorkId, created.id);
          workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
          renderWorkList();
        } catch {
          /* link is best-effort */
        }
        // A new session starts a fresh thread: the work's cached
        // conversation is cleared with it (same as "Clear chat").
        chatCache.delete(selectedWorkId);
        saveChatCache();
        void loadWorkArtifacts(selectedWorkId);
      }
      clearChat();
      focusChat();
    } catch (err) {
      addChatError(
        `Could not start a session: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  // Chat starts empty, with a short hint. A draft typed earlier is
  // restored, so closing the panel never loses an unsent message.
  showChatHint();
  restoreChatDraft();
  renderStatusPill();
  $("#chat-text").addEventListener("input", saveChatDraft);
  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chat-text") as HTMLInputElement;
    const text = input.value;
    input.value = "";
    localStorage.removeItem(CHAT_DRAFT_KEY);
    await sendChat(text);
  });

  // Streaming weave events arrive over the backend's SSE bridge.
  if (isTauri) {
    await listen<LoomStreamEvent>("loom-stream", (event) => {
      handleStreamEvent(event.payload);
    });
    await listen<StreamEnvelope<WorkflowProgressEvent>>("loom-workflow", (event) => {
      handleWorkflowStreamEvent(event.payload);
    });
    await listen<StreamEnvelope<AbTestEvent>>("loom-abtest", (event) => {
      handleAbtestEvent(event.payload);
    });
    await listen<StreamEnvelope<unknown>>("loom-session", (event) => {
      handleSessionEvent(event.payload);
    });
  }
  const stopBtn = $("#chat-stop") as HTMLButtonElement | null;
  if (stopBtn) stopBtn.addEventListener("click", () => {
    if (activeStreamId) void cancelLoomStream(activeStreamId);
  });
  // The header pill is also the re-check control: click to probe again.
  $("#loom-status").addEventListener("click", () => {
    void getLoomStatus().then((s) => setLoomReachable(s.online));
  });
  $("#session-delete").addEventListener("click", () => { void deleteSelectedSession(); });
  $("#session-resume").addEventListener("click", () => { void resumeSelectedSession(); });
  initAgentsView();

  // Provider A/B and workflow schedules.
  $("#abtest-btn").addEventListener("click", openAbtestDialog);
  $("#abtest-start").addEventListener("click", () => { void startAbtest(); });
  $("#abtest-cancel").addEventListener("click", () => ($("#abtest-dialog") as HTMLDialogElement).close());
  $("#schedule-cancel").addEventListener("click", () => ($("#schedule-dialog") as HTMLDialogElement).close());
  $("#schedule-submit").addEventListener("click", () => { void submitSchedule(); });

}

init().catch((err) => {
  console.error("Loom IDE failed to start:", err);
  const log = $("#chat-log");
  if (log) {
    const warn = document.createElement("div");
    warn.className = "typing";
    warn.textContent = "Could not load workspace data. Showing an empty workspace.";
    log.append(warn);
  }
});
