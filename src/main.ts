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
  deleteIntent,
  executeWorkflow,
  getAgent,
  getArtifactStats,
  getAttention,
  getCollaboration,
  getExperiments,
  getIntents,
  getLoomStatus,
  getServerConfig,
  getSession,
  getSessionHistory,
  getStorageStatus,
  getWorkflowExecution,
  getWorkItems,
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
  type CollabStep,
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
  type EvidenceKind,
  evidenceKindLabel,
  type AutonomyChange,
} from "./api";
import { Sphere, type SphereState } from "./sphere";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Mode = "code" | "experiment" | "work" | "agents" | "evidence" | "layers" | "artifacts";

type NoteKind = "design" | "scratch";

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
  {
    id: "sphere",
    label: "Sphere",
    desc: "The luminous sphere in Experiment mode.",
  },
];

const CAPTIONS: Record<SphereState, string> = {
  idle: "At rest — nothing is running.",
  listening: "Listening — Loom is with you.",
  processing: "Thinking — preparing a reply.",
  executing: "An agent is working on your work.",
  attention: "Needs you — a decision is waiting.",
  completed: "Done — back at rest.",
};

/** The two real local documents. They are the user's own notes, not
    seeded content: both start empty and persist in localStorage. */
const NOTE_DOCS: { id: string; title: string; detail: string; kind: NoteKind }[] = [
  { id: "doc-design", title: "Design philosophy", detail: "Your design notes", kind: "design" },
  { id: "doc-scratch", title: "Scratch notes", detail: "Your scratch pad", kind: "scratch" },
];

let workItems: WorkItem[] = [];
let selectedWorkId: string | null = null;
/** Intents (the primary object): one intent owns many pieces of work. */
let intents: Intent[] = [];
let activeIntentId: string | null = null;
/** The intent editor open in the pinned header; null when closed. */
let intentEditor: { mode: "create" } | { mode: "edit"; id: string } | null = null;
let mode: Mode = "experiment";
let sphereState: SphereState = "idle";
let currentNote: NoteKind = "design";
let artifactTab: "artifacts" | "documents" = "artifacts";
let loomReachable = false;
let loomVerified = false;
/** False until the first status probe resolves; the UI shows a neutral
    "Checking Loom…" state instead of flashing "offline" meanwhile. */
let loomStatusKnown = false;
let collabSteps: CollabStep[] = [];
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
let artifacts: Artifact[] = [];
/** Artifacts for the selected work ("what this work produced"): scoped to
    the work's session when it has one, otherwise the global list. */
let workArtifacts: Artifact[] = [];
let runningWorkflow: string | null = null;
/** When true, stop polling the current workflow run and clear the
    running state. The server-side execution continues (there is no cancel
    endpoint), but the UI stops tracking it — honest about the limit
    instead of pretending control that doesn't exist (P2 Human Agency). */
let cancelWorkflow = false;
/** Workflow names for executions started in this session (the server does
    not report a workflow name on executions). */
const executionWorkflowNames = new Map<string, string>();
let lastFocus: HTMLElement | null = null;
const layerOn: Record<string, boolean> = {
  light: true,
  water: true,
  glass: true,
  sphere: true,
};

const $ = <T extends HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;

// ---------------------------------------------------------------------------
// Sphere
// ---------------------------------------------------------------------------

const sphere = new Sphere($("#sphere") as HTMLCanvasElement);
sphere.startAnimation();

function setSphereState(state: SphereState) {
  sphereState = state;
  sphere.setState(state);
  $("#sphere-caption").textContent = CAPTIONS[state];
}

function fitSphere() {
  sphere.resize();
}
new ResizeObserver(fitSphere).observe($("#sphere") as HTMLCanvasElement);
window.addEventListener("resize", fitSphere);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) sphere.stop();
  else if (mode === "experiment") sphere.startAnimation();
});

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
      const title = document.createElement("span");
      title.className = "work-title";
      title.textContent = item.title;
      const time = document.createElement("span");
      time.className = "work-time";
      time.textContent = timeLabel(item);

      btn.append(dot, title, time);
      btn.addEventListener("click", () => selectWork(item.id));
      li.append(btn);
      list.append(li);
    }
    applySearchFilter(($("#search-input") as HTMLInputElement).value);
  });
}

function selectWork(id: string) {
  selectedWorkId = id;
  const item = workItems.find((w) => w.id === id);
  if (item) {
    $("#objective-title").textContent = item.title;
  }
  renderWorkList();
  renderWorkDetail();
  renderInspectorContext();
  syncSessionToWork();
  void loadWorkArtifacts(id);
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
  return `L${entry.level} · ${entry.label}`;
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
  } catch {
    intents = [];
    activeIntentId = null;
  }
  renderIntentHeader();
}

function renderIntentHeader() {
  withFocusRestore(() => {
    const header = document.querySelector<HTMLElement>("#intent-header");
    if (!header) return;
    header.innerHTML = "";
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
    try {
      const created = await createIntent({ statement });
      await setActiveIntent(created.id);
      await refreshIntents();
    } catch (err) {
      showFieldError(
        error,
        `Could not create the intent: ${err instanceof Error ? err.message : String(err)}`,
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

  // Acceptance checklist: ticking toggles a criterion (no version bump).
  const criteria = intent.acceptance ?? [];
  if (criteria.length === 0) {
    const none = document.createElement("p");
    none.className = "intent-why";
    none.textContent = "No acceptance criteria yet. Edit the intent to add what done means.";
    root.append(none);
  } else {
    const ul = document.createElement("ul");
    ul.className = "intent-checklist";
    criteria.forEach((c, i) => {
      const li = document.createElement("li");
      if (c.done) li.className = "done";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = c.done;
      box.setAttribute("aria-label", `Mark done: ${c.text}`);
      box.addEventListener("change", async () => {
        const next = criteria.map((item, idx) =>
          idx === i ? { ...item, done: box.checked } : item,
        );
        try {
          await setIntentAcceptance({ id: intent.id, criteria: next });
          await refreshIntents();
        } catch (err) {
          box.checked = !box.checked;
          addChatError(
            `Could not save the acceptance: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
      const text = document.createElement("span");
      text.textContent = c.text;
      li.append(box, text);
      ul.append(li);
    });
    root.append(ul);
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
  currentValue.textContent = `L${AUTONOMY_LEVELS[current].level} · ${AUTONOMY_LEVELS[current].label}`;
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
    const currentRank = AUTONOMY_LEVELS[current].level - 1;
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
      fromTo.textContent = `L${AUTONOMY_LEVELS[change.from as IntentAutonomy].level} → L${AUTONOMY_LEVELS[change.to as IntentAutonomy].level}`;
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
}): void {
  const overlay = document.createElement("div");
  overlay.id = "autonomy-dialog-overlay";
  overlay.className = "autonomy-dialog-overlay";
  const currentEntry = AUTONOMY_LEVELS[d.current];
  const targetEntry = AUTONOMY_LEVELS[d.target];
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
  });
  overlay.querySelector("#autonomy-dialog-apply")!.addEventListener("click", () => {
    d.onApply(ta.value.trim() || null);
    closeAutonomyDialog();
  });
  // Close on overlay click (but not on inner dialog clicks).
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAutonomyDialog();
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
  const autonomyField = buildAutonomyField(
    existing?.autonomy ?? "collaborative",
    existing?.autonomy_history ?? [],
    async (next, justification) => {
      try {
        await updateIntent({
          id: existing!.id,
          statement: statementInput.value.trim() || existing!.statement,
          why: whyInput.value.trim() || null,
          autonomy: next,
          status: statusSelect.value as "active" | "done",
          justification,
        });
        // Re-render with updated history.
        intentEditor = { mode: "edit", id: existing!.id };
        renderIntentHeader();
      } catch (err) {
        showFieldError(error, err instanceof Error ? err.message : String(err));
      }
    },
  );
  row.append(autonomyField);
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
  row.append(autonomyField, statusField);
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
    try {
      if (editor.mode === "create") {
        const created = await createIntent({ statement, why, acceptance: criteria, autonomy });
        await setActiveIntent(created.id);
        if (status === "done") {
          await updateIntent({ id: created.id, status: "done" });
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
        // Acceptance is a separate call and never bumps the version.
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
      showFieldError(
        error,
        `Could not save the intent: ${err instanceof Error ? err.message : String(err)}`,
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

/** Build the summary block for one work item. */
function buildWorkSummary(item: WorkItem): HTMLElement {
  const root = document.createElement("div");
  root.className = "work-summary";

  // Row 1: dot + title + metadata.
  const top = document.createElement("div");
  top.className = "ws-top";
  const dot = document.createElement("span");
  dot.className = `work-dot ${item.status}`;
  const body = document.createElement("div");
  body.className = "ws-body";
  const title = document.createElement("div");
  title.className = "ws-title";
  title.textContent = item.title;
  const meta = document.createElement("div");
  meta.className = "ws-meta";
  meta.textContent = metaLabel(item);
  body.append(title, meta);

  // The intent this work belongs to: clicking it makes that intent the
  // active one. Work created before intents existed has none and shows
  // no line.
  const intent = item.intent_id
    ? intents.find((i) => i.id === item.intent_id)
    : undefined;
  if (intent) {
    const intentRow = document.createElement("div");
    intentRow.className = "ws-intent";
    const intentLabel = document.createElement("span");
    intentLabel.className = "ws-intent-label";
    intentLabel.textContent = "Intent:";
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
    intentRow.append(intentLabel, intentBtn);
    body.append(intentRow);
  }

  top.append(dot, body);

  // Row 2: planning preference + supported local action.
  const controls = document.createElement("div");
  controls.className = "ws-controls";
  const label = document.createElement("label");
  label.className = "ctl-label";
  label.textContent = "Planning mode:";
  label.append(
    buildAutonomyDial(
      item.autonomy as IntentAutonomy,
      async (next, justification) => {
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
        }
      },
      item.autonomy_history ?? [],
    ),
  );

  const stateBtn = document.createElement("button");
  stateBtn.type = "button";
  stateBtn.className = "btn";
  stateBtn.textContent = item.status === "active" ? "Mark paused" : "Mark active";
  stateBtn.title =
    "Local planning — this saves a state on this device. It does not pause a running agent.";

  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;

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

  const conv = document.createElement("button");
  conv.type = "button";
  conv.className = "btn ghost";
  conv.textContent = "Conversation";
  conv.addEventListener("click", () => focusChat(conv));

  controls.append(label, stateBtn, conv, error);

  const note = document.createElement("p");
  note.className = "ws-note";
  note.textContent =
    "Local planning — this saves a preference on this device. It does not pause a running agent or change how agents behave.";

  root.append(top, controls, note);
  return root;
}

// ---------------------------------------------------------------------------
// Work detail view (the selected work; the catalogue stays on the left)
// ---------------------------------------------------------------------------

function renderWorkDetail() {
  withFocusRestore(() => {
    const wrap = document.querySelector<HTMLElement>("#work-detail");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (workItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wd-empty";
      const text = document.createElement("p");
      text.textContent =
        "No work yet. Create a work item to give this workspace something to focus on.";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn";
      btn.textContent = "Create work";
      btn.addEventListener("click", () => focusNewWork(btn));
      empty.append(text, btn);
      wrap.append(empty);
      return;
    }

    const item = workItems.find((w) => w.id === selectedWorkId);
    if (!item) {
      const empty = document.createElement("div");
      empty.className = "wd-empty";
      const text = document.createElement("p");
      text.textContent = "Select a work item from the list.";
      empty.append(text);
      wrap.append(empty);
      return;
    }

    wrap.append(buildWorkSummary(item));

    const scroll = document.createElement("div");
    scroll.className = "wd-scroll";

    // Success criteria — editable by the human.
    scroll.append(buildSuccessCriteria(item));

    // Workflows — run real Loom workflows under this work item.
    scroll.append(buildWorkflowsSection());

    // Artifacts — attach real Loom artifacts.
    scroll.append(buildArtifactsSection(item));

    // Evidence — experiment decisions + Loom findings (honest).
    scroll.append(buildEvidenceSection());

    wrap.append(scroll);
  });
}

// ---- Success criteria (editable, local) ----

function buildSuccessCriteria(item: WorkItem): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const h = document.createElement("h4");
  h.textContent = "Success criteria";
  section.append(h);

  const criteria = item.success_criteria ?? [];
  if (criteria.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No criteria yet. Add one to define what done means.";
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
  input.placeholder = "Add a criterion…";
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
    // Disable while saving so two rapid submits cannot race on the same
    // stale snapshot; the input clears only after a successful save.
    input.disabled = true;
    add.disabled = true;
    const ok = await saveCriteria(item.id, [...criteria, v]);
    if (ok) {
      input.value = "";
    } else {
      input.disabled = false;
      add.disabled = false;
    }
  });
  section.append(form);
  return section;
}

/** In-flight criteria saves, per work item: a second save while one is
    running would read the same stale snapshot and drop a criterion. */
const criteriaSaving = new Set<string>();

async function saveCriteria(workId: string, criteria: string[]): Promise<boolean> {
  if (criteriaSaving.has(workId)) return false;
  criteriaSaving.add(workId);
  try {
    const updated = await setWorkSuccessCriteria(workId, criteria);
    workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
    renderWorkDetail();
    return true;
  } catch (err) {
    addChatError(
      `Could not save the criteria: ${err instanceof Error ? err.message : String(err)}`,
    );
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

  if (!loomStatusKnown) {
    section.append(emptyP("Checking the Loom server…"));
    return section;
  }
  if (!loomReachable) {
    section.append(emptyP("The Loom server is offline — workflows are not available."));
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

      // Cancel/dismiss: stops polling and clears the running state.
      // The server-side execution continues (no cancel endpoint exists),
      // so this is honest about the limit instead of pretending control.
      if (runningWorkflow !== null) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn ghost danger";
        cancel.textContent = "Dismiss";
        cancel.title = "Stop tracking this run. The server-side execution continues.";
        cancel.addEventListener("click", () => {
          cancelWorkflow = true;
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
    section.append(emptyP("No executions yet."));
  } else {
    const ul = document.createElement("ul");
    ul.className = "execution-list";
    for (const ex of executions.slice(0, 10)) {
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
  }
  return section;
}

async function refreshExecutionsList() {
  try {
    executions = await listWorkflowExecutions();
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
  runningWorkflow = name;
  cancelWorkflow = false;
  renderWorkDetail();
  setSphereState("executing");
  try {
    // execute_workflow returns the run's own result, so the UI can show
    // the run's actual output instead of only re-listing executions.
    const res = await executeWorkflow(name);
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
      await refreshExecutionsList();
      await pollWorkflowExecution(res.execution_id);
    } else {
      await refreshExecutionsList();
    }
    runningWorkflow = null;
    cancelWorkflow = false;
    renderWorkDetail();
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    await refreshExecutionsList();
    runningWorkflow = null;
    cancelWorkflow = false;
    renderWorkDetail();
    setSphereState("idle");
    if (isLoomConnectionError(err)) setLoomReachable(false);
    addChatError(
      `Workflow "${name}" failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---- Artifacts (real Loom server, attach to work item) ----

function buildArtifactsSection(item: WorkItem): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const head = document.createElement("div");
  head.className = "wd-section-head";
  const h = document.createElement("h4");
  h.textContent = "Artifacts";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "icon-btn small";
  refresh.title = "Refresh artifacts";
  refresh.setAttribute("aria-label", "Refresh artifacts");
  refresh.textContent = "↻";
  refresh.addEventListener("click", () => refreshArtifacts());
  head.append(h, refresh);
  section.append(head);

  if (!loomStatusKnown) {
    section.append(emptyP("Checking the Loom server…"));
    return section;
  }
  if (!loomReachable) {
    section.append(emptyP("The Loom server is offline — artifacts are not available."));
    return section;
  }
  if (workArtifacts.length === 0) {
    section.append(emptyP("No artifacts for this work yet."));
    return section;
  }

  const attached = new Set(item.artifact_ids ?? []);
  const ul = document.createElement("ul");
  ul.className = "artifact-list";
  for (const a of workArtifacts) {
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
  return section;
}

/** Load the selected work's artifacts ("what this work produced"): scoped
    to the work's session when it has one, otherwise the global list. */
async function loadWorkArtifacts(workId: string) {
  const item = workItems.find((w) => w.id === workId);
  if (!item) return;
  if (!item.session_id) {
    workArtifacts = [...artifacts];
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
    renderWorkDetail();
  }
}

async function refreshArtifacts() {
  try {
    artifacts = await listArtifacts();
    setLoomReachable(true);
  } catch (err) {
    if (isLoomConnectionError(err)) setLoomReachable(false);
    artifacts = [];
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
  const ids = new Set(item.artifact_ids ?? []);
  if (currentlyAttached) ids.delete(artifactId);
  else ids.add(artifactId);
  try {
    const updated = await setWorkArtifacts(item.id, [...ids]);
    workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
    renderWorkDetail();
    renderArtifacts();
  } catch (err) {
    // Re-render to restore the toggle's previous state.
    renderWorkDetail();
    addChatError(
      `Could not update artifacts: ${err instanceof Error ? err.message : String(err)}`,
    );
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
function evidenceItems(): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const e of experiments.filter((x) => x.decision)) {
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

function buildEvidenceSection(): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const h = document.createElement("h4");
  h.textContent = "Evidence";
  section.append(h);

  const items = evidenceItems();
  if (items.length === 0) {
    section.append(
      emptyP("No findings yet. Experiment decisions and workflow results appear here as evidence once made."),
    );
    return section;
  }
  const ul = document.createElement("ul");
  ul.className = "evidence-list";
  for (const item of items) {
    const li = document.createElement("li");
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
    li.append(head, detail);
    ul.append(li);
  }
  section.append(ul);
  return section;
}

function emptyP(text: string): HTMLElement {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  return p;
}

function focusNewWork(from?: HTMLElement) {
  if (window.matchMedia("(max-width: 1099px)").matches) {
    openLeftDrawer(from);
  }
  ($("#new-work-input") as HTMLInputElement).focus();
}

// ---------------------------------------------------------------------------
// Inspector: Context (collaboration + attention, from the backend)
// ---------------------------------------------------------------------------

function renderInspectorContext() {
  if (!document.querySelector("#collab-steps")) return;
  renderSteps(collabSteps);
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
    model.textContent = p.model;
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
  if (!serverConfig || Object.keys(serverConfig.config).length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  content.innerHTML = "";
  const dl = document.createElement("dl");
  dl.className = "config-list";
  for (const [k, v] of Object.entries(serverConfig.config) as [string, string][]) {
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
  detail.textContent = storageStatus.detail || "—";
  content.append(status, backend, detail);
}

function renderSteps(steps: CollabStep[]) {
  const list = $("#collab-steps");
  list.innerHTML = "";
  if (steps.length === 0) {
    // No step-level execution data: show the registered agents honestly.
    if (agents.length === 0) {
      const li = document.createElement("li");
      li.className = "step";
      const label = document.createElement("span");
      label.className = "step-label";
      label.textContent = !loomStatusKnown
        ? "Checking Loom…"
        : loomReachable
          ? "No agents registered"
          : "Loom offline";
      li.append(label);
      list.append(li);
      $("#agent-status").textContent = !loomStatusKnown
        ? "Checking Loom…"
        : loomReachable
          ? "No agents running"
          : "Loom offline";
      const prog = $("#agent-progress");
      if (prog) prog.textContent = "";
      return;
    }
    const running = agents.filter((a) => a.status === "running").length;
    $("#agent-status").textContent =
      running > 0
        ? `${running} of ${agents.length} agents running`
        : `${agents.length} agent${agents.length === 1 ? "" : "s"} · none running`;
    const prog = $("#agent-progress");
    if (prog) prog.textContent = "";
    for (const a of agents) {
      const li = document.createElement("li");
      li.className = `step ${a.status === "running" ? "active" : ""}`;
      const mark = document.createElement("span");
      mark.className = "mark";
      const label = document.createElement("span");
      label.className = "step-label";
      label.textContent = a.name;
      const status = document.createElement("span");
      status.className = "step-pct";
      status.textContent = a.status;
      li.append(mark, label, status);
      list.append(li);
    }
    return;
  }
  // "Step 3 of 5" is not the same as "2 of 5 completed": the active
  // step counts toward neither the done total nor the current step
  // twice.
  const done = steps.filter((s) => s.state === "done").length;
  const activeIdx = steps.findIndex((s) => s.state === "active");
  $("#agent-status").textContent =
    activeIdx >= 0
      ? `Step ${activeIdx + 1} of ${steps.length}`
      : `${done} of ${steps.length} completed`;
  const prog = $("#agent-progress");
  if (prog) prog.textContent = `${done} of ${steps.length} completed`;
  for (const step of steps) {
    const li = document.createElement("li");
    li.className = `step ${step.state}`;
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = step.state === "done" ? "✓" : "";
    const label = document.createElement("span");
    label.className = "step-label";
    label.textContent = step.label;
    li.append(mark, label);
    if (step.progress !== null && step.progress !== undefined) {
      const pct = document.createElement("span");
      pct.className = "step-pct";
      pct.textContent = `${step.progress}%`;
      li.append(pct);
    }
    list.append(li);
  }
}

function renderAttention(items: AttentionItem[]) {
  const list = $("#attention-list");
  list.innerHTML = "";
  $("#att-count").textContent = String(items.length);
  if (items.length === 0) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "step-label";
    span.textContent = "No attention items";
    li.append(span);
    list.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    const row = document.createElement("div");
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
    row.append(ico, text);
    li.append(row);
    list.append(li);
  }
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
}

// ---------------------------------------------------------------------------
// Drawers + inspector tabs
// ---------------------------------------------------------------------------

function isInspectorDrawer(): boolean {
  return window.matchMedia("(max-width: 1439px)").matches;
}

function isLeftDrawer(): boolean {
  return window.matchMedia("(max-width: 1099px)").matches;
}

function updateScrim() {
  // The inspector (Context) is a non-modal drawer: it never raises the
  // scrim and never closes on an outside click. Only the left (work)
  // drawer is modal and raises the scrim.
  const open = document.body.classList.contains("left-open");
  $("#scrim").hidden = !open;
}

// The inspector holds Context only now. The chat lives in the left
// column and opens on demand, so there is no tab to switch and no
// inspector state for the conversation.
function openInspector(opener?: HTMLElement) {
  if (opener) lastFocus = opener;
  if (isInspectorDrawer()) {
    document.body.classList.add("inspector-open");
    $("#context-toggle").setAttribute("aria-expanded", "true");
    updateScrim();
  } else {
    $("#context-toggle").setAttribute("aria-expanded", "true");
  }
}

function closeInspector() {
  document.body.classList.remove("inspector-open");
  $("#context-toggle").setAttribute("aria-expanded", "false");
  updateScrim();
  if (lastFocus) {
    lastFocus.focus();
    lastFocus = null;
  }
}

// ---------------------------------------------------------------------------
// Conversation panel — on demand, closed by default
// ---------------------------------------------------------------------------

const CHAT_OPEN_KEY = "loom-ide-tauri:chat-open";

/** Whether the Conversation panel is open. Closed by default: the work
    objects are the record, and the chat is a way to create and discuss
    them, not the place they live. */
let chatOpen = false;

function loadChatOpen() {
  try {
    const raw = localStorage.getItem(CHAT_OPEN_KEY);
    if (!raw) return;
    const value = JSON.parse(raw) as unknown;
    if (typeof value === "boolean") chatOpen = value;
  } catch {
    /* ignore */
  }
}

function saveChatOpen() {
  try {
    localStorage.setItem(CHAT_OPEN_KEY, JSON.stringify(chatOpen));
  } catch {
    /* ignore */
  }
}

function applyChatOpen() {
  document.body.classList.toggle("chat-open", chatOpen);
  $("#chat-toggle").setAttribute("aria-expanded", String(chatOpen));
}

/** Show or hide the Conversation panel in place. Opening it on narrow
    screens also opens the left drawer, so the panel is reachable there.
    Hiding it changes nothing about the conversation: the session
    binding, the per-work cache, and the draft are all untouched. */
function setChatOpen(open: boolean, opener?: HTMLElement) {
  chatOpen = open;
  saveChatOpen();
  applyChatOpen();
  if (open && isLeftDrawer()) {
    openLeftDrawer(opener);
  }
}

/** The chat lives in the left column and opens on demand; this opens
    it (and the left drawer on narrow screens) and focuses the message
    box. */
function focusChat(from?: HTMLElement) {
  setChatOpen(true, from);
  ($("#chat-text") as HTMLInputElement).focus();
}

function openLeftDrawer(opener?: HTMLElement) {
  if (opener) lastFocus = opener;
  if (isLeftDrawer()) {
    document.body.classList.add("left-open");
    $("#work-toggle").setAttribute("aria-expanded", "true");
    updateScrim();
    ($("#left-close") as HTMLButtonElement).focus();
  }
}

function closeLeftDrawer() {
  document.body.classList.remove("left-open");
  $("#work-toggle").setAttribute("aria-expanded", "false");
  updateScrim();
  if (lastFocus) {
    lastFocus.focus();
    lastFocus = null;
  }
}

function closeDrawers() {
  closeInspector();
  closeLeftDrawer();
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

function renderAgents() {
  const list = $("#agents-list");
  list.innerHTML = "";
  if (agents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "flat-row empty-row";
    const title = document.createElement("strong");
    title.textContent = !loomStatusKnown
      ? "Checking the Loom server…"
      : loomReachable
        ? "No agents registered"
        : "Loom offline";
    const text = document.createElement("p");
    text.textContent = !loomStatusKnown
      ? "Waiting for the Loom server status."
      : loomReachable
        ? "No agents are registered with the Loom server yet. When you send a message, the answering agent appears here."
        : "The Loom server is not reachable, so no agents are visible.";
    empty.append(title, text);
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
    list.append(row);
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
    const title = document.createElement("strong");
    title.textContent = "No evidence yet";
    const text = document.createElement("p");
    text.textContent =
      "Evidence appears here when experiment decisions are made or workflows produce results.";
    empty.append(title, text);
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
// Layers view
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

function renderLayers() {
  const list = $("#layers-list");
  list.innerHTML = "";
  for (const layer of LAYERS) {
    const row = document.createElement("div");
    row.className = "flat-row layer-row";
    const text = document.createElement("div");
    text.className = "layer-text";
    const label = document.createElement("strong");
    label.textContent = layer.label;
    const desc = document.createElement("span");
    desc.textContent = layer.desc;
    text.append(label, desc);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "switch";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(layerOn[layer.id]));
    toggle.setAttribute("aria-label", `Toggle ${layer.label}`);
    toggle.addEventListener("click", () => {
      layerOn[layer.id] = !layerOn[layer.id];
      document
        .querySelector(".scene")
        ?.classList.toggle(`no-${layer.id}`, !layerOn[layer.id]);
      toggle.setAttribute("aria-checked", String(layerOn[layer.id]));
      saveLayers();
    });
    row.append(text, toggle);
    list.append(row);
  }
}

// ---------------------------------------------------------------------------
// Artifacts view (Artifacts + Documents tabs)
// ---------------------------------------------------------------------------

function setArtifactTab(tab: "artifacts" | "documents") {
  artifactTab = tab;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("#artifact-tabs .tab")) {
    btn.classList.toggle("active", btn.dataset.atab === tab);
  }
  renderArtifacts();
  if (tab === "artifacts") {
    // Keep the global list fresh when the view is opened.
    void refreshGlobalArtifacts();
  }
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
    for (const doc of NOTE_DOCS) {
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
    const title = document.createElement("strong");
    title.textContent = "No artifacts yet";
    const text = document.createElement("p");
    text.textContent = "Artifacts appear here when the Loom server shares them.";
    empty.append(title, text);
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
}

// ---------------------------------------------------------------------------
// Search (filters the work catalogue by title)
// ---------------------------------------------------------------------------

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
  setSphereState("processing");

  const log = $("#chat-log");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "Loom is thinking…";
  log.append(typing);
  log.scrollTop = log.scrollHeight;

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
    setSphereState("idle");
  }
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
  none.textContent =
    sessions.length === 0
      ? loomReachable
        ? "No sessions yet"
        : "Loom offline"
      : "No session";
  sel.append(none);
  for (const s of sessions) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = sessionLabel(s);
    sel.append(opt);
  }
  // Render only: never drop the selection here. If the adopted session is
  // not in the list yet, the dropdown shows "No session" until the next
  // refresh brings it — the selection itself survives.
  sel.value = sessions.some((s) => s.id === previous) ? previous : "";
  sel.disabled = sessions.length === 0;
}

function renderAgentBar() {
  const sel = $("#agent-select") as HTMLSelectElement;
  const previous = selectedAgentId ?? sel.value;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent =
    agents.length === 0
      ? loomReachable
        ? "Default agent"
        : "Loom offline"
      : "Default agent";
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
    renderAgentBar();
    renderSessionBar();
    loadChatForWork(selectedWorkId, null);
  }
}

// ---------------------------------------------------------------------------
// Workspace explorer — a read-only tree over the Loom workspace (~/.loom).
// Lists all its directories and files; clicking a text file opens it in the
// editor read-only. Independent of the Loom server.
// ---------------------------------------------------------------------------

const dirCache = new Map<string, DirEntry[]>();
const expandedDirs = new Set<string>();
let openFilePath: string | null = null;

function renderFileTree() {
  const tree = $("#file-tree");
  tree.innerHTML = "";
  const root = dirCache.get("") ?? [];
  if (root.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tree-empty";
    empty.textContent = "No files found in the workspace.";
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
  const editor = $("#code-editor") as HTMLTextAreaElement;
  const pathEl = $("#code-path");
  try {
    const text = await readFile(path);
    editor.value = text;
    editor.readOnly = true;
    openFilePath = path;
    pathEl.textContent = path;
    pathEl.classList.remove("error");
    pathEl.hidden = false;
    ($("#code-save") as HTMLButtonElement).disabled = true;
    for (const tab of document.querySelectorAll<HTMLButtonElement>(".code-tab")) {
      tab.classList.remove("active");
    }
    renderFileTree();
  } catch (err) {
    pathEl.textContent = `Could not open: ${err instanceof Error ? err.message : String(err)}`;
    pathEl.classList.add("error");
    pathEl.hidden = false;
  }
}

async function loadWorkspaceTree() {
  const tree = $("#file-tree");
  try {
    dirCache.set("", await listWorkspace());
  } catch (err) {
    dirCache.set("", []);
    tree.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "tree-empty";
    empty.textContent = `Could not read the workspace: ${err instanceof Error ? err.message : String(err)}`;
    tree.append(empty);
    return;
  }
  renderFileTree();
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
      empty.textContent = "No experiments yet.";
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
    const title = document.createElement("strong");
    title.textContent = "No experiment selected";
    const text = document.createElement("p");
    text.textContent =
      "Create an experiment to state a question, define arms, and compare real results.";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "New experiment";
    btn.addEventListener("click", () => openNewExperimentForm());
    empty.append(title, text, btn);
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

  // Result rows: each arm's result, with a diff hint when two results
  // differ. Results are shown verbatim — the human judges, not the UI.
  for (const arm of arms) {
    const row = document.createElement("div");
    row.className = "comp-row";
    const label = document.createElement("span");
    label.className = "comp-cell comp-label";
    label.textContent = `Result — ${arm.label}`;
    row.append(label);
    const cell = document.createElement("span");
    cell.className = "comp-cell";
    const pre = document.createElement("pre");
    pre.className = "arm-result comp-result";
    pre.textContent = arm.result || "(no result recorded)";
    cell.append(pre);
    row.append(cell);
    grid.append(row);
  }

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
    setSphereState("idle");
  }
}

// ---------------------------------------------------------------------------
// Modes (the footer mode switcher is the single navigation control)
// ---------------------------------------------------------------------------

const ALL_VIEWS: Mode[] = [
  "experiment",
  "work",
  "code",
  "agents",
  "evidence",
  "layers",
  "artifacts",
];

function closeMenus() {
  setChatMenu(false);
}

/** Open/close the chat menu, keeping aria-expanded in sync. */
function setChatMenu(open: boolean) {
  const chatMenu = $("#chat-menu");
  if (chatMenu) chatMenu.hidden = !open;
  $("#chat-menu-btn").setAttribute("aria-expanded", String(open));
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
}

function setMode(next: Mode) {
  if (mode === next) {
    closeMenus();
    return;
  }
  const wasExperiment = mode === "experiment";
  mode = next;
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".mode-btn")) {
    btn.classList.toggle("active", btn.dataset.mode === next);
  }
  for (const id of ALL_VIEWS) {
    const el = document.getElementById(`view-${id}`);
    if (el) el.hidden = id !== next;
  }
  // The scene follows the mode: water + full gradient only in Experiment.
  document.querySelector(".scene")?.setAttribute("data-mode", next);
  // Pause the sphere when its view is hidden; resume in Experiment.
  if (next === "experiment") {
    fitSphere();
    sphere.startAnimation();
  } else if (wasExperiment) {
    sphere.stop();
  }
  closeMenus();
}

// ---------------------------------------------------------------------------
// Code editor (prototype: notes persist in localStorage, start empty)
// ---------------------------------------------------------------------------

const NOTE_KEY_DESIGN = "loom-ide-tauri:design-note";
const NOTE_KEY_SCRATCH = "loom-ide-tauri:scratch-note";

function noteKey(kind: NoteKind): string {
  return kind === "design" ? NOTE_KEY_DESIGN : NOTE_KEY_SCRATCH;
}

function loadNote() {
  const editor = $("#code-editor") as HTMLTextAreaElement;
  editor.value = localStorage.getItem(noteKey(currentNote)) ?? "";
  editor.readOnly = false;
  openFilePath = null;
  const pathEl = $("#code-path");
  pathEl.hidden = true;
  pathEl.classList.remove("error");
  ($("#code-save") as HTMLButtonElement).disabled = false;
}

function saveNote() {
  // A workspace file is open in the editor, not a note: saving here would
  // overwrite the current note with the file's text.
  if (openFilePath) return;
  const editor = $("#code-editor") as HTMLTextAreaElement;
  localStorage.setItem(noteKey(currentNote), editor.value);
}

/** Open Code mode showing one of the two notes. */
function openNote(kind: NoteKind) {
  saveNote();
  currentNote = kind;
  loadNote();
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".code-tab")) {
    tab.classList.toggle("active", tab.dataset.note === kind);
  }
  setMode("code");
}

function initCodeEditor() {
  const editor = $("#code-editor") as HTMLTextAreaElement;
  loadNote();
  for (const tab of document.querySelectorAll<HTMLButtonElement>(".code-tab")) {
    tab.addEventListener("click", () => {
      saveNote();
      currentNote = tab.dataset.note as NoteKind;
      loadNote();
      for (const t of document.querySelectorAll<HTMLButtonElement>(".code-tab")) {
        t.classList.toggle("active", t === tab);
      }
    });
  }
  $("#code-save").addEventListener("click", () => {
    saveNote();
    const note = $("#code-saved");
    note.hidden = false;
    window.setTimeout(() => (note.hidden = true), 2000);
  });
  $("#code-ask").addEventListener("click", async () => {
    focusChat();
    await sendChat(`About this text: ${editor.value.slice(0, 280)}`);
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  // Modes
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".mode-btn")) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode as Mode));
  }
  // Artifact tabs.
  for (const tab of document.querySelectorAll<HTMLButtonElement>("#artifact-tabs .tab")) {
    tab.addEventListener("click", () => {
      setArtifactTab(tab.dataset.atab as "artifacts" | "documents");
    });
  }
  // Clicking anywhere else closes the popover menus.
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest("#chat-menu") && !target.closest("#chat-menu-btn")) {
      const chatMenu = $("#chat-menu");
      if (chatMenu && !chatMenu.hidden) setChatMenu(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (
        document.body.classList.contains("inspector-open") ||
        document.body.classList.contains("left-open")
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
    // Focus trap for the modal left drawer: Tab cycles within it instead
    // of moving into the page behind the scrim.
    if (e.key === "Tab" && document.body.classList.contains("left-open")) {
      const drawer = $("#left-col");
      const focusables = [...drawer.querySelectorAll<HTMLElement>(
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

  // Header toggles.
  $("#work-toggle").addEventListener("click", (e) => {
    if (document.body.classList.contains("left-open")) closeLeftDrawer();
    else openLeftDrawer(e.currentTarget as HTMLElement);
  });
  $("#context-toggle").addEventListener("click", (e) => {
    // A real toggle at drawer widths; at desktop widths the inspector is
    // always visible, so the button is a no-op there.
    if (isInspectorDrawer()) {
      if (document.body.classList.contains("inspector-open")) {
        closeInspector();
      } else {
        openInspector(e.currentTarget as HTMLElement);
      }
    }
  });
  $("#chat-toggle").addEventListener("click", (e) => {
    // A real toggle at every width: the Conversation panel is closed by
    // default, so this is the way to open it on wide screens too.
    setChatOpen(!chatOpen, e.currentTarget as HTMLElement);
  });
  $("#left-close").addEventListener("click", () => closeLeftDrawer());
  $("#right-close").addEventListener("click", () => closeInspector());
  $("#scrim").addEventListener("click", () => closeLeftDrawer());
  window.addEventListener("resize", () => {
    if (!isInspectorDrawer()) {
      document.body.classList.remove("inspector-open");
    }
    if (!isLeftDrawer()) {
      document.body.classList.remove("left-open");
    }
    updateScrim();
  });

  // Search: filters the work catalogue by title.
  $("#search-btn").addEventListener("click", () => {
    const input = $("#search-input") as HTMLInputElement;
    setSearchOpen(Boolean(input.hidden));
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

  // Intent header: pinned above the work detail in Work mode. It lives
  // inside #view-work, so it only shows in Work mode. Created here (not
  // in index.html) so the header renders from state, like the work
  // detail below it.
  const intentHeader = document.createElement("header");
  intentHeader.id = "intent-header";
  intentHeader.className = "intent-header";
  $("#view-work").prepend(intentHeader);

  // Work
  await refreshIntents();
  workItems = await getWorkItems();
  selectedWorkId = workItems[0]?.id ?? null;
  renderWorkList();
  renderWorkDetail();
  if (selectedWorkId) {
    const item = workItems.find((w) => w.id === selectedWorkId);
    if (item) $("#objective-title").textContent = item.title;
  }
  $("#new-work-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#new-work-input") as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;
    try {
      const item = await addWorkItem(title, activeIntentId);
      workItems = [item, ...workItems];
      input.value = "";
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
  });

  // Collaboration + attention (attention is real: experiments waiting
  // for a decision). The status probe runs first so the first paint does
  // not flash "offline" while the server is actually up.
  try {
    const status = await getLoomStatus();
    setLoomReachable(status.online);
  } catch {
    setLoomReachable(false);
  }
  collabSteps = await getCollaboration();
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
  loadChatOpen();
  applyChatOpen();
  loadLayers();
  applyLayerClasses();
  renderAgents();
  renderEvidence();
  renderLayers();
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
    } else {
      clearChat();
      sessionDetail = null;
    }
  });
  $("#agent-select").addEventListener("change", async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    selectedAgentId = v || null;
    if (v) localStorage.setItem(AGENT_KEY, v);
    else localStorage.removeItem(AGENT_KEY);
    if (v) void refreshAgentDetail(v);
    else selectedAgentDetail = null;
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

  // Workspace explorer (local filesystem; independent of the server).
  $("#file-tree-refresh").addEventListener("click", () => {
    dirCache.delete("");
    expandedDirs.clear();
    openFilePath = null;
    loadWorkspaceTree();
  });
  loadWorkspaceTree();

  // Chat starts empty, with a short hint. A draft typed earlier is
  // restored, so closing the panel never loses an unsent message.
  showChatHint();
  restoreChatDraft();
  $("#chat-text").addEventListener("input", saveChatDraft);
  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chat-text") as HTMLInputElement;
    const text = input.value;
    input.value = "";
    localStorage.removeItem(CHAT_DRAFT_KEY);
    await sendChat(text);
  });

  // Code editor
  initCodeEditor();

  // Sphere sizing (after first layout)
  requestAnimationFrame(fitSphere);
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
