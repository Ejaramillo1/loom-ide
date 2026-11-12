import "./style.css";
import {
  addExperiment,
  addExperimentArm,
  addWorkItem,
  askLoom,
  chooseExperimentArm,
  createSession,
  getAttention,
  getCollaboration,
  getExperiments,
  getLoomStatus,
  getSessionHistory,
  getWorkItems,
  listAgents,
  listDirectory,
  listSessions,
  listWorkspace,
  readFile,
  setExperimentArmResult,
  setExperimentArmStatus,
  setWorkAutonomy,
  setWorkSession,
  setWorkStatus,
  type Agent,
  type AttentionItem,
  type ChatReply,
  type CollabStep,
  type DirEntry,
  type Experiment,
  type ExperimentArm,
  type Session,
  type WorkItem,
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
let mode: Mode = "experiment";
let sphereState: SphereState = "idle";
let currentNote: NoteKind = "design";
let artifactTab: "artifacts" | "documents" = "artifacts";
let loomReachable = false;
let loomVerified = false;
let collabSteps: CollabStep[] = [];
let attentionItems: AttentionItem[] = [];
let sessions: Session[] = [];
let selectedSessionId: string | null = null;
let agents: Agent[] = [];
let selectedAgentId: string | null = null;
let experiments: Experiment[] = [];
let selectedExperimentId: string | null = null;
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

/** Short time token for list rows: "Now" / "2h ago". */
function timeLabel(item: WorkItem): string {
  return item.updated_label === "Now"
    ? "Now"
    : `${item.updated_label} ago`;
}

/** Metadata line: status + when it was updated. Autonomy is shown
    once, in its labeled control — never here. */
function metaLabel(item: WorkItem): string {
  const when =
    item.updated_label === "Now"
      ? "Updated now"
      : `Updated ${item.updated_label} ago`;
  return `${capitalize(item.status)} · ${when}`;
}

// ---------------------------------------------------------------------------
// Work list (left catalogue)
// ---------------------------------------------------------------------------

function renderWorkList() {
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
  top.append(dot, body);

  // Row 2: planning preference + supported local action.
  const controls = document.createElement("div");
  controls.className = "ws-controls";
  const label = document.createElement("label");
  label.className = "ctl-label";
  label.textContent = "Planning mode:";
  const autonomy = document.createElement("select");
  autonomy.className = "autonomy-select";
  autonomy.setAttribute("aria-label", `Planning mode for ${item.title}`);
  for (const level of ["manual", "assisted", "collaborative", "delegated"] as const) {
    const opt = document.createElement("option");
    opt.value = level;
    opt.textContent = capitalize(level);
    if (item.autonomy === level) opt.selected = true;
    autonomy.append(opt);
  }
  label.append(autonomy);

  const stateBtn = document.createElement("button");
  stateBtn.type = "button";
  stateBtn.className = "btn";
  stateBtn.textContent = item.status === "active" ? "Mark paused" : "Mark active";
  stateBtn.title =
    "Local planning — this saves a state on this device. It does not pause a running agent.";

  const error = document.createElement("span");
  error.className = "field-error";
  error.hidden = true;

  autonomy.addEventListener("change", async () => {
    clearFieldError(error);
    const previous = item.autonomy;
    try {
      const updated = await setWorkAutonomy(item.id, autonomy.value as WorkItem["autonomy"]);
      workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
      renderWorkList();
      renderWorkDetail();
    } catch (err) {
      autonomy.value = previous;
      showFieldError(
        error,
        `Could not save the planning mode: ${err instanceof Error ? err.message : String(err)}`,
      );
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

  // Goal: the work item's own title is its goal statement.
  scroll.append(detailSection("Goal", item.title, null));

  // Success criteria — none are recorded anywhere yet; never fabricate.
  scroll.append(
    detailSection("Success criteria", null, "No success criteria recorded."),
  );

  // Artifacts and evidence come from the Loom server when it shares
  // them; until then the honest state is empty.
  scroll.append(detailSection("Artifacts", null, "No artifacts attached."));
  scroll.append(detailSection("Evidence", null, "No evidence attached."));

  wrap.append(scroll);
}

function detailSection(
  heading: string,
  text: string | null,
  emptyText: string | null,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "wd-section";
  const h = document.createElement("h4");
  h.textContent = heading;
  section.append(h);
  if (text !== null) {
    const p = document.createElement("p");
    p.textContent = text;
    section.append(p);
  } else if (emptyText) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = emptyText;
    section.append(p);
  }
  return section;
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
      label.textContent = loomReachable ? "No agents registered" : "Loom offline";
      li.append(label);
      list.append(li);
      $("#agent-status").textContent = "No agents running";
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
// column and is always visible, so there is no tab to switch and no
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

/** The chat lives in the left column and is always visible; this just
    brings it into view (opening the left drawer on narrow screens) and
    focuses the message box. */
function focusChat(from?: HTMLElement) {
  if (isLeftDrawer()) {
    openLeftDrawer(from);
  }
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
    title.textContent = loomReachable ? "No agents registered" : "Loom offline";
    const text = document.createElement("p");
    text.textContent = loomReachable
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
// Evidence view — empty until the Loom server shares findings
// ---------------------------------------------------------------------------

function renderEvidence() {
  const list = $("#evidence-list");
  list.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "flat-row empty-row";
  const title = document.createElement("strong");
  title.textContent = "No evidence yet";
  const text = document.createElement("p");
  text.textContent =
    "Evidence appears here when the Loom server shares findings and traces.";
  empty.append(title, text);
  list.append(empty);
}

// ---------------------------------------------------------------------------
// Layers view
// ---------------------------------------------------------------------------

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
  // Artifacts come from the Loom server when it shares them.
  const empty = document.createElement("div");
  empty.className = "flat-row empty-row";
  const title = document.createElement("strong");
  title.textContent = "No artifacts yet";
  const text = document.createElement("p");
  text.textContent =
    "Artifacts appear here when the Loom server shares them.";
  empty.append(title, text);
  list.append(empty);
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
    src.textContent = "Live — answered by the Loom server";
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
  addChatMessage("user", clean);
  if (selectedWorkId) cacheChatMessage(selectedWorkId, "user", clean);
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
    renderStatusPill();
    addChatMessage("loom", reply.text, reply);
    if (selectedWorkId) cacheChatMessage(selectedWorkId, "loom", reply.text);
    // Refresh agent activity: the answering agent's counters just changed.
    await refreshAgents();
    // Adopt the session the server reports (it may have auto-created one).
    if (reply.session_id) {
      selectedSessionId = reply.session_id;
      if (!sessions.some((s) => s.id === reply.session_id)) {
        await refreshSessions();
      }
      renderSessionBar();
    }
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    typing.remove();
    // Keep the failed text in the composer so it can be retried.
    ($("#chat-text") as HTMLInputElement).value = clean;
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
  const want = sessions.some((s) => s.id === previous) ? previous : "";
  sel.value = want;
  selectedSessionId = want || null;
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
  const want = agents.some((a) => (a.name || a.id) === previous) ? previous : "";
  sel.value = want;
  selectedAgentId = want || null;
  sel.disabled = agents.length === 0;
}

async function refreshSessions() {
  try {
    sessions = await listSessions();
  } catch {
    sessions = [];
  }
  renderSessionBar();
}

async function refreshAgents() {
  try {
    agents = await listAgents();
  } catch {
    agents = [];
  }
  renderAgentBar();
  renderAgents();
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
const chatCache = new Map<string, CachedChatMsg[]>();

function loadChatCache() {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, CachedChatMsg[]>;
      for (const [k, v] of Object.entries(obj)) chatCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function saveChatCache() {
  try {
    const obj: Record<string, CachedChatMsg[]> = {};
    for (const [k, v] of chatCache) obj[k] = v;
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function cacheChatMessage(workId: string, who: "user" | "loom", text: string) {
  const msgs = chatCache.get(workId) ?? [];
  msgs.push({ who, text });
  chatCache.set(workId, msgs);
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
    session history only when there is no cache for that work yet. */
function loadChatForWork(workId: string | null, sessionId: string | null) {
  const cached = workId ? chatCache.get(workId) : undefined;
  if (cached && cached.length > 0) {
    renderChatMessages(cached);
    return;
  }
  if (sessionId) {
    loadChatHistory(sessionId, workId);
  } else {
    clearChat();
  }
}

async function loadChatHistory(sessionId: string, workId: string | null) {
  const log = $("#chat-log");
  log.innerHTML = "";
  try {
    const messages = await getSessionHistory(sessionId);
    const msgs: CachedChatMsg[] = messages
      .filter((m) => m.content && m.content.trim())
      .map((m) => ({
        who: m.role === "user" ? "user" : "loom",
        text: m.content,
      }));
    if (workId) {
      chatCache.set(workId, msgs);
      saveChatCache();
    }
    renderChatMessages(msgs);
  } catch {
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
    if (sess?.agent_id) {
      selectedAgentId = sess.agent_id;
      renderAgentBar();
    }
    renderSessionBar();
    loadChatForWork(selectedWorkId, sid);
  } else {
    selectedSessionId = null;
    renderSessionBar();
    clearChat();
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

  const doneArms = exp.arms.filter((a) => a.status === "done");
  if (exp.decision) {
    const decided = exp.arms.find((a) => a.id === exp.decision);
    const dec = document.createElement("div");
    dec.className = "exp-decision decided";
    const label = document.createElement("strong");
    label.textContent = `Decision: ${decided?.label ?? exp.decision}`;
    dec.append(label);
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
  row.append(actions);
  return row;
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

/** Run one arm as a real Loom request in the current session. */
async function runExperimentArm(exp: Experiment, arm: ExperimentArm) {
  if (!loomReachable) {
    addChatError("The Loom server is offline — an arm run needs it.");
    return;
  }
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
  if (selectedWorkId) {
    cacheChatMessage(selectedWorkId, "user", `Run experiment arm: ${arm.label}`);
  }
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
    renderStatusPill();
    addChatMessage("loom", reply.text, reply);
    if (selectedWorkId) cacheChatMessage(selectedWorkId, "loom", reply.text);
    await refreshAgents();
    // Adopt the session the server reports (it may have auto-created one).
    if (reply.session_id) {
      selectedSessionId = reply.session_id;
      if (!sessions.some((s) => s.id === reply.session_id)) {
        await refreshSessions();
      }
      renderSessionBar();
      if (selectedWorkId) {
        try {
          const linked = await setWorkSession(selectedWorkId, reply.session_id);
          workItems = workItems.map((w) => (w.id === linked.id ? linked : w));
        } catch {
          /* link is best-effort */
        }
      }
    }
    const done = await setExperimentArmResult(exp.id, arm.id, reply.text);
    replaceExperiment(done);
    renderExperiments();
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    typing.remove();
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
  const chatMenu = $("#chat-menu");
  if (chatMenu) chatMenu.hidden = true;
}

function renderStatusPill() {
  const pill = $("#loom-status");
  const text = $("#loom-status-text");
  if (loomVerified) {
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
      if (chatMenu) chatMenu.hidden = true;
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
    // The inspector holds Context only. In drawer mode this opens it;
    // its ✕ button or Escape closes it.
    openInspector(e.currentTarget as HTMLElement);
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
    menu.hidden = !menu.hidden;
  });
  $("#chat-clear").addEventListener("click", () => {
    const log = $("#chat-log");
    log.innerHTML = "";
    showChatHint();
    if (selectedWorkId) {
      chatCache.delete(selectedWorkId);
      saveChatCache();
    }
    closeMenus();
  });

  // Work
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
      const item = await addWorkItem(title);
      workItems = [item, ...workItems];
      input.value = "";
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

  // Collaboration + attention (empty until the Loom server exposes them).
  collabSteps = await getCollaboration();
  attentionItems = await getAttention();
  renderInspectorContext();

  // Workspace views.
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

  // Loom server status: "Server reachable" is the TCP probe;
  // "Connected to Loom" only after a verified live reply.
  const status = await getLoomStatus();
  loomReachable = status.online;
  renderStatusPill();

  // Sessions + agents (from the Loom server). The selected work item's
  // session is the source of truth for the conversation; switch to it.
  await refreshAgents();
  await refreshSessions();
  loadChatCache();
  syncSessionToWork();

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
      } catch {
        /* link is best-effort */
      }
    }
    if (v) loadChatHistory(v, selectedWorkId);
    else clearChat();
  });
  $("#agent-select").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    selectedAgentId = v || null;
    if (v) localStorage.setItem(AGENT_KEY, v);
    else localStorage.removeItem(AGENT_KEY);
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
        } catch {
          /* link is best-effort */
        }
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
