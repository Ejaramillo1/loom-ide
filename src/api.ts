// Frontend <-> Rust bridge.
// Under Tauri, calls go to real Rust commands (src-tauri/src/lib.rs).
// In a plain browser (vite dev without Tauri) the same calls fall back to
// local seed data, so the UI can be previewed and iterated on anywhere.

import { invoke } from "@tauri-apps/api/core";

export interface WorkItem {
  id: string;
  title: string;
  status: "active" | "paused";
  autonomy: "manual" | "assisted" | "collaborative" | "delegated";
  updated_label: string;
}

export interface CollabStep {
  id: string;
  label: string;
  state: "done" | "active" | "pending";
  progress: number | null;
}

export interface AttentionItem {
  id: string;
  kind: "decision" | "finding";
  title: string;
  detail: string;
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
  source: "live" | "demonstration";
  card: ChatCard | null;
}

const IN_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isTauri = IN_TAURI;

// ---- Seed data (mirrors the Rust backend seeds; used as fallback) ----

export const seedWorkItems: WorkItem[] = [
  {
    id: "work-1",
    title: "Investigate agent memory latency",
    status: "active",
    autonomy: "collaborative",
    updated_label: "Now",
  },
  {
    id: "work-2",
    title: "Improve tool reliability",
    status: "paused",
    autonomy: "assisted",
    updated_label: "2h",
  },
  {
    id: "work-3",
    title: "Review PR #4287",
    status: "paused",
    autonomy: "manual",
    updated_label: "4h",
  },
];

export const seedSteps: CollabStep[] = [
  { id: "step-1", label: "Analyze baseline traces", state: "done", progress: null },
  { id: "step-2", label: "Reproduce with memory on/off", state: "done", progress: null },
  { id: "step-3", label: "Run configuration experiments", state: "active", progress: 68 },
  { id: "step-4", label: "Compare results", state: "pending", progress: null },
  { id: "step-5", label: "Identify likely causes", state: "pending", progress: null },
];

export const seedAttention: AttentionItem[] = [
  {
    id: "att-1",
    kind: "decision",
    title: "Decision: next experiment",
    detail: "2 configurations ready",
  },
  {
    id: "att-2",
    kind: "finding",
    title: "Finding: memory adds ~340 ms",
    detail: "Consistent across 3 runs",
  },
];

const LOCAL_KEY = "loom-ide-tauri:work-items";

function localWorkItems(): WorkItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as WorkItem[];
  } catch {
    /* ignore */
  }
  return seedWorkItems;
}

function saveLocalWorkItems(items: WorkItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

// ---- Commands ----

export async function getWorkItems(): Promise<WorkItem[]> {
  if (!IN_TAURI) return localWorkItems();
  return invoke<WorkItem[]>("get_work_items");
}

export async function addWorkItem(title: string): Promise<WorkItem> {
  if (!IN_TAURI) {
    const items = localWorkItems();
    const item: WorkItem = {
      id: `work-${Date.now()}`,
      title,
      status: "paused",
      autonomy: "collaborative",
      updated_label: "Now",
    };
    saveLocalWorkItems([item, ...items]);
    return item;
  }
  return invoke<WorkItem>("add_work_item", { title });
}

export async function setWorkStatus(
  id: string,
  status: "active" | "paused",
): Promise<WorkItem> {
  if (!IN_TAURI) {
    const items = localWorkItems().map((w) =>
      w.id === id ? { ...w, status } : w,
    );
    saveLocalWorkItems(items);
    return items.find((w) => w.id === id)!;
  }
  return invoke<WorkItem>("set_work_status", { id, status });
}

export async function setWorkAutonomy(
  id: string,
  autonomy: WorkItem["autonomy"],
): Promise<WorkItem> {
  if (!IN_TAURI) {
    const items = localWorkItems().map((w) =>
      w.id === id ? { ...w, autonomy } : w,
    );
    saveLocalWorkItems(items);
    return items.find((w) => w.id === id)!;
  }
  return invoke<WorkItem>("set_work_autonomy", { id, autonomy });
}

export async function getCollaboration(): Promise<CollabStep[]> {
  if (!IN_TAURI) return seedSteps;
  return invoke<CollabStep[]>("get_collaboration");
}

export async function getAttention(): Promise<AttentionItem[]> {
  if (!IN_TAURI) return seedAttention;
  return invoke<AttentionItem[]>("get_attention");
}

export async function getLoomStatus(): Promise<LoomStatus> {
  if (!IN_TAURI) {
    try {
      await loomRequest("/health");
      return { online: true, url: "/api/loom", detail: "Loom HTTP service is healthy." };
    } catch (error) {
      return { online: false, url: "/api/loom", detail: String(error) };
    }
  }
  return invoke<LoomStatus>("get_loom_status");
}

async function loomRequest(path: string, body?: object): Promise<any> {
  const response = await fetch(`/api/loom${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(body ? 180000 : 5000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || value.error || `Loom returned HTTP ${response.status}`);
  return value;
}

export async function askLoom(message: string): Promise<ChatReply> {
  if (IN_TAURI) return invoke<ChatReply>("ask_loom", { message });
  const value = await loomRequest("/v1/weave", { query: message });
  const text = [value.response, value.text, value.content, value.reply, value.message]
    .find(value => typeof value === "string" && value.trim());
  if (!text) throw new Error("Loom returned an empty response. Check its agent configuration.");
  return { text, source: "live", card: null };
}

/** The same honest demo fallback the Rust backend uses. */
export function demoReply(message: string): ChatReply {
  if (/experiment/i.test(message)) {
    return {
      text: "Sure. Based on the current findings, here's a proposal:",
      source: "demonstration",
      card: { title: "Experiment design", detail: "Compare memory strategies" },
    };
  }
  return {
    text:
      "I can help with that once the Loom server is running. " +
      "Right now I'm answering from demonstration data, so I can't run agents or read live traces.",
    source: "demonstration",
    card: null,
  };
}
