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

type Mode = "code" | "experiment" | "work";

const OBJECTIVES: Record<string, string> = {
  "work-1": "Understand why enabling agent memory increases latency.",
  "work-2": "Improve tool reliability.",
  "work-3": "Review PR #4287.",
};

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
}

function renderWorkCards() {
  const wrap = $("#work-cards");
  wrap.innerHTML = "";
  for (const item of workItems) {
    const card = document.createElement("div");
    card.className = "work-card";

    const dot = document.createElement("span");
    dot.className = `work-dot ${item.status}`;

    const body = document.createElement("div");
    body.className = "wc-body";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = `${capitalize(item.status)} · ${capitalize(item.autonomy)} · ${item.updated_label} ago`;
    body.append(title, meta);

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
    });

    card.append(dot, body, autonomy, toggle);
    wrap.append(card);
  }
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

function setMode(next: Mode) {
  if (mode === next) return;
  mode = next;
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".mode-btn")) {
    btn.classList.toggle("active", btn.dataset.mode === next);
  }
  $("#view-experiment").hidden = next !== "experiment";
  $("#view-work").hidden = next !== "work";
  $("#view-code").hidden = next !== "code";
  if (next === "experiment") fitSphere();
}

// ---------------------------------------------------------------------------
// Code editor (prototype: notes persist in localStorage)
// ---------------------------------------------------------------------------

const NOTE_KEY = "loom-ide-tauri:design-note";

function initCodeEditor() {
  const editor = $("#code-editor") as HTMLTextAreaElement;
  editor.value = localStorage.getItem(NOTE_KEY) ?? DESIGN_NOTE;
  $("#code-save").addEventListener("click", () => {
    localStorage.setItem(NOTE_KEY, editor.value);
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
  // Rail: work/code switch modes; the rest keep the sphere view.
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".rail-btn")) {
    btn.addEventListener("click", () => {
      for (const b of document.querySelectorAll<HTMLButtonElement>(".rail-btn")) {
        b.classList.toggle("active", b === btn);
      }
      const section = btn.dataset.section;
      if (section === "work") setMode("work");
      else if (section === "code") setMode("code");
      else setMode("experiment");
    });
  }

  // Work
  workItems = await getWorkItems();
  selectedWorkId = workItems[0]?.id ?? null;
  renderWorkList();
  renderWorkCards();
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
  renderSteps(await getCollaboration());
  renderAttention(await getAttention());

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
