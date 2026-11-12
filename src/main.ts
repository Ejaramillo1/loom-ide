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

const OBJECTIVES: Record<string, string> = {
  "work-1": "Understand why enabling agent memory increases latency.",
  "work-2": "Improve tool reliability.",
  "work-3": "Review PR #4287.",
};

// ---- Demonstration seed data for the new views --------------------------
// Everything here is labelled as demonstration in the UI, like the
// collaboration steps and attention items already were.

interface EvidenceItem {
  id: string;
  title: string;
  detail: string;
  basis: string;
  state: "collected" | "partial" | "pending";
}

const EVIDENCE: EvidenceItem[] = [
  {
    id: "ev-1",
    title: "Finding: memory adds ~340 ms",
    detail: "Consistent across 3 runs",
    basis:
      "3 replications, memory on vs off, same prompts. Baseline traces compared run by run.",
    state: "collected",
  },
  {
    id: "ev-2",
    title: "Baseline traces analyzed",
    detail: "Memory on/off pair captured",
    basis:
      "Trace spans from the baseline run set. Demonstration traces, not a live server.",
    state: "collected",
  },
  {
    id: "ev-3",
    title: "Configuration experiments",
    detail: "3 of 5 configurations run — 68%",
    basis: "Run configuration experiments step. 2 configurations still to run.",
    state: "partial",
  },
  {
    id: "ev-4",
    title: "Compare results",
    detail: "Not yet collected",
    basis: "Starts when the configuration experiments finish.",
    state: "pending",
  },
  {
    id: "ev-5",
    title: "Identify likely causes",
    detail: "Not yet collected",
    basis: "Needs the comparison first.",
    state: "pending",
  },
];

interface ArtifactItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  body?: string;
  action: "expand" | "code-design" | "code-scratch" | "evidence";
}

const ARTIFACTS: ArtifactItem[] = [
  {
    id: "art-1",
    kind: "Experiment plan",
    title: "Experiment design",
    detail: "Compare memory strategies",
    body: "Proposal from the chat with Loom: compare memory on/off across 3 configurations, same prompts, measure latency per run. Demonstration.",
    action: "expand",
  },
  {
    id: "art-2",
    kind: "Note",
    title: "Design philosophy note",
    detail: "01 — Design Philosophy: Quiet Complexity",
    action: "code-design",
  },
  {
    id: "art-3",
    kind: "Decision",
    title: "Decision: next experiment",
    detail: "2 configurations ready",
    body: "Two configurations are ready to run. Pick one to start the next experiment. Demonstration.",
    action: "expand",
  },
  {
    id: "art-4",
    kind: "Finding",
    title: "Finding: memory adds ~340 ms",
    detail: "Consistent across 3 runs",
    action: "evidence",
  },
];

const DOCUMENTS: ArtifactItem[] = [
  {
    id: "doc-1",
    kind: "Note",
    title: "Design philosophy note",
    detail: "01 — Design Philosophy: Quiet Complexity",
    action: "code-design",
  },
  {
    id: "doc-2",
    kind: "Note",
    title: "Scratch notes",
    detail: "Your scratch pad",
    action: "code-scratch",
  },
];

const LAYERS: { id: string; label: string; desc: string }[] = [
  {
    id: "light",
    label: "Light beam",
    desc: "The soft diagonal light across the scene.",
  },
  {
    id: "water",
    label: "Water reflection",
    desc: "The reflective band along the bottom.",
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

const PAUSE_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>';
const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5-13-7.5z" /></svg>';

const CAPTIONS: Record<SphereState, string> = {
  idle: "At rest — nothing is running.",
  listening: "Listening — Loom is with you.",
  processing: "Thinking — preparing a reply.",
  executing: "An agent is working on your work.",
  attention: "Needs you — a decision is waiting.",
  completed: "Done — back at rest.",
};

const DESIGN_NOTE = `# 01 — Design Philosophy: Quiet Complexity

*A front end for Loom designed around human intention, not around agents.*

## The one-sentence position

Loom already knows how to run agents, score them, remember them and ask a person questions. What it does not yet have is a place where a person and the system share the same work. This design builds that place: a quiet surface where intent is stated once, work is visible as objects, evidence sits next to every claim, and a person can always see — and change — how much freedom the agents have.`;

let workItems: WorkItem[] = [];
let selectedWorkId: string | null = null;
let mode: Mode = "experiment";
let sphereState: SphereState = "idle";
let agentPaused = false;
let currentNote: NoteKind = "design";
let artifactTab: "artifacts" | "documents" = "artifacts";
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

// ---------------------------------------------------------------------------
// Work list
// ---------------------------------------------------------------------------

function renderWorkList() {
  const list = $("#work-list");
  list.innerHTML = "";
  for (const item of workItems) {
    const li = document.createElement("li");
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
    time.textContent = item.updated_label;

    btn.append(dot, title, time);
    btn.addEventListener("click", () => selectWork(item.id));
    li.append(btn);
    list.append(li);
  }
}

function selectWork(id: string) {
  selectedWorkId = id;
  const item = workItems.find((w) => w.id === id);
  if (item) {
    $("#objective-title").textContent =
      OBJECTIVES[item.id] ?? item.title;
  }
  renderWorkList();
  renderWorkCards();
  renderWorkFocus();
}

/** "Active · Collaborative · Now" — never "Now ago". */
function metaLabel(item: WorkItem): string {
  const when =
    item.updated_label === "Now"
      ? "Now"
      : `${item.updated_label} ago`;
  return `${capitalize(item.status)} · ${capitalize(item.autonomy)} · ${when}`;
}

function renderWorkCards() {
  const wrap = $("#work-cards");
  wrap.innerHTML = "";
  for (const item of workItems) {
    const card = document.createElement("div");
    card.className = "work-card";

    // Row 1: dot + full-width title and meta (nothing competes for width,
    // so a title fits on one line and the meta on one line too).
    const top = document.createElement("div");
    top.className = "wc-top";
    const dot = document.createElement("span");
    dot.className = `work-dot ${item.status}`;
    const body = document.createElement("div");
    body.className = "wc-body";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = metaLabel(item);
    body.append(title, meta);
    top.append(dot, body);

    // Row 2: controls live underneath the text instead of beside it.
    const actions = document.createElement("div");
    actions.className = "wc-actions";
    const autonomy = document.createElement("select");
    autonomy.className = "autonomy-select";
    autonomy.setAttribute("aria-label", `Autonomy for ${item.title}`);
    for (const level of ["manual", "assisted", "collaborative", "delegated"] as const) {
      const opt = document.createElement("option");
      opt.value = level;
      opt.textContent = capitalize(level);
      if (item.autonomy === level) opt.selected = true;
      autonomy.append(opt);
    }
    autonomy.addEventListener("change", async () => {
      const updated = await setWorkAutonomy(item.id, autonomy.value as WorkItem["autonomy"]);
      workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
      renderWorkCards();
      renderWorkFocus();
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn";
    toggle.textContent = item.status === "active" ? "Pause" : "Resume";
    toggle.addEventListener("click", async () => {
      const next = item.status === "active" ? "paused" : "active";
      const updated = await setWorkStatus(item.id, next);
      workItems = workItems.map((w) => (w.id === updated.id ? updated : w));
      renderWorkList();
      renderWorkCards();
      renderWorkFocus();
    });
    actions.append(autonomy, toggle);

    card.append(top, actions);
    wrap.append(card);
  }
}

/** Work mode is headed by the selected work item, not by the word "Work". */
function renderWorkFocus() {
  const item = workItems.find((w) => w.id === selectedWorkId);
  if (!item) return;
  $("#work-focus-title").textContent = item.title;
  $("#work-focus-sub").textContent = metaLabel(item);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Collaboration + Attention
// ---------------------------------------------------------------------------

function renderSteps(steps: CollabStep[]) {
  const list = $("#collab-steps");
  list.innerHTML = "";
  const done = steps.filter((s) => s.state === "done" || s.state === "active").length;
  $("#agent-status").textContent = `Experimenting · ${done}/${steps.length}`;
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
  for (const item of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "att-item";
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
    btn.append(ico, text, chev);
    btn.addEventListener("click", () => {
      setSphereState("attention");
      window.setTimeout(() => setSphereState("idle"), 4000);
    });
    li.append(btn);
    list.append(li);
  }
}

// ---------------------------------------------------------------------------
// Agents view + agent pause (shared by the right panel and Agents view)
// ---------------------------------------------------------------------------

function renderAgentPause() {
  const status = agentPaused ? "Paused" : "Experimenting";
  const text = `${status} · 3/5`;
  $("#agent-status").textContent = text;
  const cardStatus = $("#agent-card-status");
  if (cardStatus) cardStatus.textContent = text;
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".agent-pause-btn")) {
    btn.classList.toggle("paused", agentPaused);
    btn.setAttribute("aria-label", agentPaused ? "Resume agent" : "Pause agent");
    btn.title = agentPaused ? "Resume agent" : "Pause agent";
    btn.innerHTML = agentPaused ? PLAY_SVG : PAUSE_SVG;
  }
  for (const ring of document.querySelectorAll(".agent-ring")) {
    ring.classList.toggle("paused", agentPaused);
  }
}

function toggleAgentPaused() {
  agentPaused = !agentPaused;
  renderAgentPause();
}

function renderAgents(steps: CollabStep[]) {
  const list = $("#agents-list");
  list.innerHTML = "";
  const done = steps.filter((s) => s.state === "done" || s.state === "active").length;

  const card = document.createElement("div");
  card.className = "agent-card glass";
  const head = document.createElement("header");
  head.className = "agent-head";
  const ring = document.createElement("span");
  ring.className = "agent-ring" + (agentPaused ? " paused" : "");
  const id = document.createElement("div");
  id.className = "agent-id";
  const name = document.createElement("strong");
  name.textContent = "Research Agent";
  const status = document.createElement("span");
  status.id = "agent-card-status";
  status.textContent = `${agentPaused ? "Paused" : "Experimenting"} · ${done}/${steps.length}`;
  id.append(name, status);
  const pause = document.createElement("button");
  pause.type = "button";
  pause.className = "pause-btn agent-pause-btn" + (agentPaused ? " paused" : "");
  pause.setAttribute("aria-label", agentPaused ? "Resume agent" : "Pause agent");
  pause.title = agentPaused ? "Resume agent" : "Pause agent";
  pause.innerHTML = agentPaused ? PLAY_SVG : PAUSE_SVG;
  pause.addEventListener("click", toggleAgentPaused);
  head.append(ring, id, pause);
  card.append(head);

  const note = document.createElement("p");
  note.className = "demo-note";
  note.textContent =
    "Demonstration data — the Loom server does not expose step-by-step execution here yet.";
  card.append(note);

  const stepsList = document.createElement("ul");
  stepsList.className = "steps";
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
    stepsList.append(li);
  }
  card.append(stepsList);
  list.append(card);

  const empty = document.createElement("div");
  empty.className = "empty-card glass";
  const emptyTitle = document.createElement("strong");
  emptyTitle.textContent = "No other agents yet";
  const emptyText = document.createElement("p");
  emptyText.textContent =
    "More agents will appear here when the Loom server exposes them.";
  empty.append(emptyTitle, emptyText);
  list.append(empty);
}

// ---------------------------------------------------------------------------
// Evidence view
// ---------------------------------------------------------------------------

function renderEvidence() {
  const list = $("#evidence-list");
  list.innerHTML = "";
  for (const item of EVIDENCE) {
    const card = document.createElement("div");
    card.className = "evidence-card glass";
    const head = document.createElement("div");
    head.className = "ev-head";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const state = document.createElement("span");
    state.className = `ev-state ${item.state}`;
    state.textContent =
      item.state === "collected"
        ? "Collected"
        : item.state === "partial"
          ? "Partial"
          : "Pending";
    head.append(title, state);
    const detail = document.createElement("p");
    detail.className = "ev-detail";
    detail.textContent = item.detail;
    const basis = document.createElement("p");
    basis.className = "ev-basis";
    basis.textContent = item.basis;
    card.append(head, detail, basis);
    list.append(card);
  }
}

// ---------------------------------------------------------------------------
// Layers view
// ---------------------------------------------------------------------------

function renderLayers() {
  const list = $("#layers-list");
  list.innerHTML = "";
  for (const layer of LAYERS) {
    const row = document.createElement("div");
    row.className = "layer-row glass";
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

function artifactClick(item: ArtifactItem, card: HTMLElement) {
  if (item.action === "expand") {
    const open = card.querySelector(".artifact-body");
    if (open) {
      open.remove();
      return;
    }
    const body = document.createElement("p");
    body.className = "artifact-body";
    body.textContent = item.body ?? item.detail;
    card.append(body);
  } else if (item.action === "code-design") {
    openNote("design");
  } else if (item.action === "code-scratch") {
    openNote("scratch");
  } else if (item.action === "evidence") {
    setMode("evidence");
  }
}

function renderArtifacts() {
  const list = $("#artifacts-list");
  list.innerHTML = "";
  const items = artifactTab === "artifacts" ? ARTIFACTS : DOCUMENTS;
  for (const item of items) {
    const wrap = document.createElement("div");
    wrap.className = "artifact-item";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "artifact-card glass";
    const kind = document.createElement("span");
    kind.className = "artifact-kind";
    kind.textContent = item.kind;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.className = "artifact-detail";
    detail.textContent = item.detail;
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "›";
    card.append(kind, title, detail, chev);
    card.addEventListener("click", () => artifactClick(item, wrap));
    wrap.append(card);
    list.append(wrap);
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function addChatMessage(
  who: "user" | "loom",
  text: string,
  reply?: ChatReply,
) {
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
    card.addEventListener("click", () => setMode("experiment"));
    msg.append(card);
  }

  if (reply && who === "loom") {
    const src = document.createElement("span");
    src.className = "chat-source";
    src.textContent =
      reply.source === "live"
        ? "Live — answered by the Loom server"
        : "Demonstration — the Loom server is not running";
    msg.append(src);
  }

  log.append(msg);
  log.scrollTop = log.scrollHeight;
}

function seedChat() {
  addChatMessage("user", "Can you help me design the next experiment?");
  addChatMessage("loom", "Sure. Based on the current findings, here's a proposal:", {
    text: "",
    source: "demonstration",
    card: { title: "Experiment design", detail: "Compare memory strategies" },
  });
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
    addChatMessage("loom", reply.text, reply);
    setSphereState("completed");
    window.setTimeout(() => {
      if (sphereState === "completed") setSphereState("idle");
    }, 3000);
  } catch (err) {
    typing.remove();
    addChatMessage("loom", "Something went wrong reaching Loom. Please try again.");
    setSphereState("idle");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Modes
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

function setMode(next: Mode) {
  if (mode === next) {
    closeMenus();
    return;
  }
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
  if (next === "experiment") fitSphere();
  closeMenus();
}

// ---------------------------------------------------------------------------
// Code editor (prototype: notes persist in localStorage)
// ---------------------------------------------------------------------------

const NOTE_KEY_DESIGN = "loom-ide-tauri:design-note";
const NOTE_KEY_SCRATCH = "loom-ide-tauri:scratch-note";

const SCRATCH_SEED = `# Scratch notes

Quick thoughts, links, and half-formed ideas.
`;

function noteKey(kind: NoteKind): string {
  return kind === "design" ? NOTE_KEY_DESIGN : NOTE_KEY_SCRATCH;
}

function noteSeed(kind: NoteKind): string {
  return kind === "design" ? DESIGN_NOTE : SCRATCH_SEED;
}

function loadNote() {
  const editor = $("#code-editor") as HTMLTextAreaElement;
  editor.value = localStorage.getItem(noteKey(currentNote)) ?? noteSeed(currentNote);
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
    setMode("experiment");
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
    if (e.key === "Escape") closeMenus();
  });

  // Search focuses the chat input.
  $("#search-btn").addEventListener("click", () => {
    ($("#chat-text") as HTMLInputElement).focus();
  });
  // Agent pause (right panel; the Agents view card wires its own button).
  $("#agent-pause").addEventListener("click", toggleAgentPaused);
  // Chat menu: clear the conversation.
  $("#chat-menu-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#chat-menu");
    menu.hidden = !menu.hidden;
  });
  $("#chat-clear").addEventListener("click", () => {
    const log = $("#chat-log");
    log.innerHTML = "";
    const note = document.createElement("div");
    note.className = "typing";
    note.textContent = "Chat cleared — start a new message below.";
    log.append(note);
    closeMenus();
  });

  // Work
  workItems = await getWorkItems();
  selectedWorkId = workItems[0]?.id ?? null;
  renderWorkList();
  renderWorkCards();
  renderWorkFocus();
  if (selectedWorkId) {
    const item = workItems.find((w) => w.id === selectedWorkId);
    if (item) $("#objective-title").textContent = OBJECTIVES[item.id] ?? item.title;
  }
  $("#new-work-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#new-work-input") as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;
    const item = await addWorkItem(title);
    workItems = [item, ...workItems];
    input.value = "";
    selectWork(item.id);
  });

  // Collaboration + attention
  const steps = await getCollaboration();
  renderSteps(steps);
  renderAttention(await getAttention());

  // New views (all demonstration data, labelled in the UI).
  renderAgents(steps);
  renderEvidence();
  renderLayers();
  renderArtifacts();

  // Loom server status
  const status = await getLoomStatus();
  const pill = $("#loom-status");
  $("#loom-status-text").textContent = status.online ? "Live" : "Demonstration";
  pill.classList.toggle("live", status.online);
  pill.title = status.detail;
  $("#demo-note").hidden = status.online;

  // Chat
  seedChat();
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
