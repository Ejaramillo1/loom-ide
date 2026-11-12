// Frontend <-> Rust bridge.
// Under Tauri, calls go to real Rust commands (src-tauri/src/lib.rs).
// In a plain browser (vite dev without Tauri) work items fall back to
// localStorage and the Loom calls go through the /api/loom dev proxy
// (see vite.config.ts). There is no demo data anywhere: when the Loom
// server is not reachable, the calls fail and the UI says so.

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
  // The backend only ever sends "live". There is no demo reply.
  source: "live";
  card: ChatCard | null;
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

// The Loom server does not expose step-by-step execution or attention
// items yet, so these return empty until it does. No seed data.
export async function getCollaboration(): Promise<CollabStep[]> {
  if (!IN_TAURI) return [];
  return invoke<CollabStep[]>("get_collaboration");
}

export async function getAttention(): Promise<AttentionItem[]> {
  if (!IN_TAURI) return [];
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

// Throws when the Loom server cannot be reached or answers without
// usable text. The caller shows the error; nothing invents a reply.
export async function askLoom(message: string): Promise<ChatReply> {
  if (IN_TAURI) return invoke<ChatReply>("ask_loom", { message });
  const value = await loomRequest("/v1/weave", { query: message });
  const text = [value.response, value.text, value.content, value.reply, value.message]
    .find(value => typeof value === "string" && value.trim());
  if (!text) throw new Error("Loom returned an empty response. Check its agent configuration.");
  return { text, source: "live", card: null };
}
