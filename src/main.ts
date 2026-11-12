import "./style.css";
import {
  addWorkItem,
  askLoom,
  getAttention,
  getCollaboration,
  getLoomStatus,
  getWorkItems,
  setWorkAutonomy,
  setWorkStatus,
  type AttentionItem,
  type ChatReply,
  type CollabStep,
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
  conv.addEventListener("click", () => openInspector("conversation", conv));

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
    const li = document.createElement("li");
    li.className = "step";
    const label = document.createElement("span");
    label.className = "step-label";
    label.textContent = "No agents running";
    li.append(label);
    list.append(li);
    $("#agent-status").textContent = "No agents running";
    const prog = $("#agent-progress");
    if (prog) prog.textContent = "";
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
  const open =
    document.body.classList.contains("inspector-open") ||
    document.body.classList.contains("left-open");
  $("#scrim").hidden = !open;
}

function setInspectorTab(tab: "context" | "conversation") {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".inspector-tab")) {
    const active = btn.id === `tab-${tab}`;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  }
  $("#inspector-context").hidden = tab !== "context";
  $("#inspector-chat").hidden = tab !== "conversation";
}

function openInspector(tab: "context" | "conversation", opener?: HTMLElement) {
  if (opener) lastFocus = opener;
  setInspectorTab(tab);
  const toggle =
    tab === "context" ? $("#context-toggle") : $("#conversation-btn");
  if (isInspectorDrawer()) {
    document.body.classList.add("inspector-open");
    toggle.setAttribute("aria-expanded", "true");
    updateScrim();
    ($("#right-close") as HTMLButtonElement).focus();
  } else {
    toggle.setAttribute("aria-expanded", "true");
  }
}

function closeInspector() {
  document.body.classList.remove("inspector-open");
  $("#context-toggle").setAttribute("aria-expanded", "false");
  $("#conversation-btn").setAttribute("aria-expanded", "false");
  updateScrim();
  if (lastFocus) {
    lastFocus.focus();
    lastFocus = null;
  }
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

function renderAgents() {
  const list = $("#agents-list");
  list.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "flat-row empty-row";
  const title = document.createElement("strong");
  title.textContent = "No agents running";
  const text = document.createElement("p");
  text.textContent =
    "No agents are running in this workspace yet. Agents appear here when the Loom server exposes them.";
  empty.append(title, text);
  list.append(empty);
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

  if (who === "loom") {
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
  setSphereState("processing");

  const log = $("#chat-log");
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "Loom is thinking…";
  log.append(typing);
  log.scrollTop = log.scrollHeight;

  try {
    const reply = await askLoom(clean);
    typing.remove();
    loomVerified = true;
    renderStatusPill();
    addChatMessage("loom", reply.text, reply);
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
// Modes (one shared navigation state: rail + footer stay in sync)
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
  const railMenu = $("#rail-menu");
  if (railMenu) railMenu.hidden = true;
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
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".rail-btn")) {
    const section = btn.dataset.section;
    btn.classList.toggle(
      "active",
      section === next || (next === "artifacts" && section === "more"),
    );
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
    openInspector("conversation");
    await sendChat(`About this note: ${editor.value.slice(0, 280)}`);
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
  // Rail: every button opens its view; More opens its menu.
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".rail-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const section = btn.dataset.section;
      if (section === "more") {
        const menu = $("#rail-menu");
        menu.hidden = !menu.hidden;
        return;
      }
      setMode(section as Mode);
    });
  }
  // More menu: Artifacts opens the Artifacts tab, Documents the Documents tab.
  for (const item of document.querySelectorAll<HTMLButtonElement>("#rail-menu button")) {
    item.addEventListener("click", () => {
      setArtifactTab(item.dataset.atab as "artifacts" | "documents");
      setMode("artifacts");
    });
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
    if (!target.closest("#rail-menu") && !target.closest(".rail-btn.more")) {
      const railMenu = $("#rail-menu");
      if (railMenu) railMenu.hidden = true;
    }
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

  // Header toggles.
  $("#work-toggle").addEventListener("click", (e) => {
    if (document.body.classList.contains("left-open")) closeLeftDrawer();
    else openLeftDrawer(e.currentTarget as HTMLElement);
  });
  $("#context-toggle").addEventListener("click", (e) => {
    if (document.body.classList.contains("inspector-open")) closeInspector();
    else openInspector("context", e.currentTarget as HTMLElement);
  });
  $("#conversation-btn").addEventListener("click", (e) => {
    openInspector("conversation", e.currentTarget as HTMLElement);
  });
  $("#left-close").addEventListener("click", () => closeLeftDrawer());
  $("#right-close").addEventListener("click", () => closeInspector());
  $("#scrim").addEventListener("click", () => closeDrawers());
  window.addEventListener("resize", () => {
    if (!isInspectorDrawer()) {
      document.body.classList.remove("inspector-open");
    }
    if (!isLeftDrawer()) {
      document.body.classList.remove("left-open");
    }
    updateScrim();
  });

  // Inspector tabs.
  $("#tab-context").addEventListener("click", () => setInspectorTab("context"));
  $("#tab-conversation").addEventListener("click", () => setInspectorTab("conversation"));

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

  // Loom server status: "Server reachable" is the TCP probe;
  // "Connected to Loom" only after a verified live reply.
  const status = await getLoomStatus();
  loomReachable = status.online;
  renderStatusPill();

  // Chat starts empty, with a short hint.
  showChatHint();
  $("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chat-text") as HTMLInputElement;
    const text = input.value;
    input.value = "";
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
