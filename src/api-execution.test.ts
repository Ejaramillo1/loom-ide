import { afterEach, beforeEach, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  vi.resetModules();
  invoke.mockClear();
  vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
});
afterEach(() => vi.unstubAllGlobals());

it("carries explicit owners through every execution bridge, including schedule resume and classification", async () => {
  const api = await import("./api");
  const commands: [string, () => Promise<unknown>][] = [
    ["ask_loom", () => api.askLoom("query", undefined, undefined, undefined, undefined, undefined, "work", "intent")],
    ["ask_loom_stream", () => api.askLoomStream("request", "query", undefined, undefined, undefined, undefined, undefined, "work", "intent")],
    ["execute_workflow", () => api.executeWorkflow("workflow", "work", "intent")],
    ["execute_workflow_stream", () => api.executeWorkflowStream("request", "workflow", "work", "intent")],
    ["provider_abtest", () => api.providerAbtest("request", "query", undefined, undefined, "work", "intent")],
    ["session_resume", () => api.resumeSession("session", "work", "intent")],
    ["workflow_schedule_trigger", () => api.triggerWorkflowSchedule("schedule", "work", "intent")],
    ["workflow_schedule_create", () => api.createWorkflowSchedule("workflow", "* * * * *", undefined, true, "work", "intent")],
    ["workflow_schedule_update", () => api.updateWorkflowSchedule("schedule", undefined, undefined, true, "work", "intent")],
    ["workflow_schedule_resume", () => api.resumeWorkflowSchedule("schedule", "work", "intent")],
    ["skills_classify", () => api.classifySkill("skill", "work", "intent")],
    ["loom_task_decompose", () => api.decomposeLoomTask("goal", undefined, undefined, "work", "intent")],
  ];
  for (const [command, run] of commands) {
    await run();
    expect(invoke).toHaveBeenLastCalledWith(command, expect.objectContaining({ workId: "work", intentId: "intent", unscoped: false }));
    expect(invoke.mock.calls.at(-1)?.[1]).not.toHaveProperty("autonomy");
  }
});

it("distinguishes explicit unscoped execution from accidentally omitted owners", async () => {
  const api = await import("./api");
  await api.askLoom("query", undefined, undefined, undefined, undefined, undefined, null, null);
  expect(invoke).toHaveBeenLastCalledWith("ask_loom", expect.objectContaining({ workId: null, intentId: null, unscoped: true }));
  await api.askLoom("query");
  expect(invoke).toHaveBeenLastCalledWith("ask_loom", expect.objectContaining({ unscoped: false }));
});
