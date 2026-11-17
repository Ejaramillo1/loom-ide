import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

const slice = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function shell() {
  const stubs = {
    executeWorkflowStream: vi.fn().mockResolvedValue(undefined),
    executeWorkflow: vi.fn().mockResolvedValue({ execution_id: "result" }),
    cancelLoomStream: vi.fn().mockResolvedValue(undefined),
    renderWorkDetail: vi.fn(), renderEvidence: vi.fn(), setSphereState: vi.fn(), setLoomReachable: vi.fn(),
    refreshExecutionsList: vi.fn().mockResolvedValue(undefined), pollWorkflowExecution: vi.fn().mockResolvedValue(undefined),
    isLoomConnectionError: vi.fn(() => false), saveOwnershipMap: vi.fn(), renderAbtest: vi.fn(), addChatError: vi.fn(),
    setExperimentArmStatus: vi.fn().mockResolvedValue({}), replaceExperiment: vi.fn(), renderExperiments: vi.fn(),
    addChatMessage: vi.fn(), cacheChatMessage: vi.fn(), buildChatContext: vi.fn(() => ({})),
    askLoom: vi.fn().mockResolvedValue({ text: "result" }), refreshAgents: vi.fn().mockResolvedValue(undefined),
    setWorkSession: vi.fn().mockResolvedValue({}), refreshSessions: vi.fn().mockResolvedValue(undefined),
    renderWorkList: vi.fn(), renderSessionBar: vi.fn(), loadWorkArtifacts: vi.fn(),
    setExperimentArmResult: vi.fn().mockResolvedValue({}), refreshAttention: vi.fn().mockResolvedValue(undefined),
  };
  const { code } = await transformWithOxc(`function install() {
    let selectedWorkId = 'w1', activeIntentId = 'unrelated', selectedSessionId = 'session-1', selectedAgentId = 'agent-1';
    let workItems = [{id:'w1', intent_id:'i1', autonomy:'collaborative'}, {id:'w2', intent_id:'i2', autonomy:'collaborative'}];
    let intents = [], sessions = [], loomReachable = true, loomVerified = false;
    let runningWorkflow = null, runSeq = 0, currentRunSeq = 0, cancelWorkflow = false, workflowError = null;
    let workflowStreamState = null, workflowStreamOrigin = null, workflowStreamIntent = null, workflowStreamActive = null;
    let workflowCancellationRequested = false, abtestState = null, sphereState = 'idle';
    const activeStreams = new Map(), executionWorkIds = new Map(), executionWorkflowNames = new Map(), experimentWorkIds = new Map();
    const EXEC_WORK_KEY = 'exec', EXP_WORK_KEY = 'exp', UNASSIGNED_KEY = 'unassigned';
    const document = {createElement: () => ({remove() {}})};
    const $ = () => ({append() {}, scrollTop: 0, scrollHeight: 0});
    const window = {setTimeout() {}};
    ${slice('interface ExecutionOwner {', 'function buildChatContext(')}
    ${slice('async function runWorkflow(name:', '// ---------------------------------------------------------------------------\n// Session subscription')}
    ${slice('function handleAbtestEvent(', 'function renderAbtest()')}
    ${slice('async function runExperimentArm(', '// ---------------------------------------------------------------------------\n// Application menus')}
    return {
      runWorkflow, handleWorkflowStreamEvent, cancelInFlightForAutonomyLower, handleAbtestEvent, runExperimentArm,
      setSelection: (id) => { selectedWorkId = id; selectedSessionId = 'session-2'; },
      getWorkflowId: () => workflowStreamActive, getError: () => workflowError, getOwners: () => executionWorkIds,
      setAb: (state) => { abtestState = state; },
    };
  }`, "execution-ownership-check.ts");
  return { api: new Function(...Object.keys(stubs), code + "\nreturn install();")(...Object.values(stubs)), stubs };
}

it("workflow fallback retains original work and linked intent across selection changes", async () => {
  const { api, stubs } = await shell();
  let reject!: (e: Error) => void;
  stubs.executeWorkflowStream.mockImplementation(() => new Promise((_r, r) => { reject = r; }));
  const pending = api.runWorkflow("flow");
  api.setSelection("w2");
  reject(new Error("stream unavailable"));
  await pending;
  expect(stubs.executeWorkflow).toHaveBeenCalledWith("flow", "w1", "i1");
  expect(api.getOwners().get("result")).toBe("w1");
});

it("autonomy lowering requests workflow cancellation and suppresses a later fallback", async () => {
  const { api, stubs } = await shell();
  let reject!: (e: Error) => void;
  stubs.executeWorkflowStream.mockImplementation(() => new Promise((_r, r) => { reject = r; }));
  const pending = api.runWorkflow("flow");
  const requestId = api.getWorkflowId();
  api.setSelection("w2");
  api.cancelInFlightForAutonomyLower([], "i1");
  expect(stubs.cancelLoomStream).toHaveBeenCalledWith(requestId);
  reject(new Error("startup rejected"));
  await pending;
  expect(stubs.executeWorkflow).not.toHaveBeenCalled();
  expect(api.getError()).toContain("No fallback was sent");
});

it("workflow cancellation errors stay visible and local closure retains attribution", async () => {
  const { api, stubs } = await shell();
  await api.runWorkflow("flow");
  const requestId = api.getWorkflowId();
  api.handleWorkflowStreamEvent({ requestId, kind: "progress", event: { executionId: "partial-run", message: "step completed" } });
  stubs.cancelLoomStream.mockRejectedValue(new Error("cannot cancel"));
  api.cancelInFlightForAutonomyLower(["w1"], null);
  await tick();
  expect(api.getError()).toContain("Cancellation request failed");
  api.handleWorkflowStreamEvent({ requestId, kind: "cancelled" });
  expect(api.getOwners().get("partial-run")).toBe("w1");
  expect(api.getError()).toContain("Server cancellation is not confirmed");
  expect(api.getError()).toContain("step completed");
});

it("provider cancellation retains partial results and leaves completed runs alone", async () => {
  const { api, stubs } = await shell();
  const state = { requestId: "ab", owner: { workId: null, intentId: "i1" }, finished: false, per: new Map() };
  api.setAb(state);
  api.handleAbtestEvent({ requestId: "ab", kind: "progress", event: { providerName: "p1", contentChunk: "partial" } });
  api.cancelInFlightForAutonomyLower([], "i1");
  expect(stubs.cancelLoomStream).toHaveBeenCalledWith("ab");
  api.handleAbtestEvent({ requestId: "ab", kind: "cancelled" });
  expect(state.per.get("p1").text).toBe("partial");
  expect(state.finished).toBe(true);
  api.cancelInFlightForAutonomyLower([], "i1");
  expect(stubs.cancelLoomStream).toHaveBeenCalledTimes(1);
});

it("experiment arms capture ownership and session before awaiting the local running status", async () => {
  const { api, stubs } = await shell();
  let resolve!: (value: unknown) => void;
  stubs.setExperimentArmStatus.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = api.runExperimentArm({ id: "exp", title: "fixture", question: "q", hypothesis: "h" }, { id: "arm", label: "a" });
  api.setSelection("w2");
  resolve({});
  await pending;
  expect(stubs.askLoom).toHaveBeenCalledWith(expect.any(String), "session-1", "agent-1", {}, undefined, undefined, "w1", "i1");
  expect(stubs.cacheChatMessage).toHaveBeenCalledWith("w1", "loom", "result");
});
