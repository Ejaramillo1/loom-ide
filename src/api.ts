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
  // The Loom session associated with this work item (if any).
  session_id?: string | null;
  success_criteria?: string[];
  artifact_ids?: string[];
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
  // Set when the server reports which session the reply belongs to.
  session_id?: string | null;
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
  uptime_seconds: number;
  active_sessions: number;
  total_messages: number;
}

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
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
}

export interface Artifact {
  id: string;
  name: string;
  purpose: string;
  source: string;
  created_at: number;
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

export async function setWorkSession(
  id: string,
  sessionId: string | null,
): Promise<WorkItem> {
  if (!IN_TAURI) {
    const items = localWorkItems().map((w) =>
      w.id === id ? { ...w, session_id: sessionId } : w,
    );
    saveLocalWorkItems(items);
    return items.find((w) => w.id === id)!;
  }
  return invoke<WorkItem>("set_work_session", { id, sessionId });
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
export async function askLoom(
  message: string,
  sessionId?: string,
  agentId?: string,
): Promise<ChatReply> {
  if (IN_TAURI) {
    return invoke<ChatReply>("ask_loom", { message, sessionId, agentId });
  }
  const body: Record<string, string> = { query: message };
  if (sessionId) body.session_id = sessionId;
  if (agentId) body.agent_id = agentId;
  const value = await loomRequest("/v1/weave", body);
  const text = [value.text, value.response, value.content, value.reply, value.message]
    .find(value => typeof value === "string" && value.trim());
  if (!text) throw new Error("Loom returned an empty response. Check its agent configuration.");
  return { text, source: "live", card: null };
}

// ---- Sessions + agents (real Loom server; fail honestly when offline) ----

export async function listSessions(): Promise<Session[]> {
  return invoke<Session[]>("list_sessions");
}

export async function createSession(
  name?: string,
  agentId?: string,
): Promise<Session> {
  return invoke<Session>("create_session", { name, agentId });
}

export async function listAgents(): Promise<Agent[]> {
  return invoke<Agent[]>("list_agents");
}

export async function getSessionHistory(sessionId: string): Promise<HistoryMessage[]> {
  return invoke<HistoryMessage[]>("get_session_history", { sessionId });
}

// ---- Workspace explorer (local filesystem; works without the server) ----

export async function listWorkspace(): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_workspace");
}

export async function listDirectory(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_directory", { path });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

// ---- Experiments (local definitions; arms run through real Loom calls) ----

export async function getExperiments(): Promise<Experiment[]> {
  return invoke<Experiment[]>("get_experiments");
}

export async function addExperiment(
  title: string,
  question: string,
  hypothesis: string,
): Promise<Experiment> {
  return invoke<Experiment>("add_experiment", { title, question, hypothesis });
}

export async function addExperimentArm(
  id: string,
  label: string,
  config: string,
): Promise<Experiment> {
  return invoke<Experiment>("add_experiment_arm", { id, label, config });
}

export async function setExperimentArmStatus(
  id: string,
  armId: string,
  status: string,
): Promise<Experiment> {
  return invoke<Experiment>("set_experiment_arm_status", { id, armId, status });
}

export async function setExperimentArmResult(
  id: string,
  armId: string,
  result: string,
): Promise<Experiment> {
  return invoke<Experiment>("set_experiment_arm_result", { id, armId, result });
}

export async function chooseExperimentArm(
  id: string,
  armId: string,
): Promise<Experiment> {
  return invoke<Experiment>("choose_experiment_arm", { id, armId });
}

// ---- Work detail: success criteria + attachments (local, via work store) ----

export async function setWorkSuccessCriteria(
  id: string,
  criteria: string[],
): Promise<WorkItem> {
  return invoke<WorkItem>("set_work_success_criteria", { id, criteria });
}

export async function setWorkArtifacts(
  id: string,
  artifactIds: string[],
): Promise<WorkItem> {
  return invoke<WorkItem>("set_work_artifacts", { id, artifactIds });
}

// ---- Workflows + artifacts (real Loom server) ----

export async function listWorkflows(): Promise<Workflow[]> {
  return invoke<Workflow[]>("list_workflows");
}

export async function executeWorkflow(workflowRef: string): Promise<string> {
  return invoke<string>("execute_workflow", { workflowRef });
}

export async function listWorkflowExecutions(): Promise<WorkflowExecution[]> {
  return invoke<WorkflowExecution[]>("list_workflow_executions");
}

export async function listArtifacts(): Promise<Artifact[]> {
  return invoke<Artifact[]>("list_artifacts");
}
