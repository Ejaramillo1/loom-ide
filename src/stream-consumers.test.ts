import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// Exercises the real streaming-consumer code (workflow stream handling,
// session subscription lifecycle, provider A/B decoding) against stubbed
// collaborators, pinning QC-13 / QC-17 and the camelCase NDJSON wire
// shapes to the actual implementation.

function slice(marker: string, endMarker: string): string {
  return source.slice(source.indexOf(marker), source.indexOf(endMarker));
}

const workflowCode = slice("function finishWorkflowRun(", "async function runWorkflowUnary(");
const sessionCode = slice("/** Live session state:", "/** Provider A/B:");
const abtestCode = slice("function handleAbtestEvent(", "function renderAbtest()");

async function build(code: string, extras: string, params: string[], args: any[]) {
  const { code: js } = await transformWithOxc(
    `function install() { ${code} ${extras} }`,
    "stream-consumers-check.ts",
  );
  const api = new Function(...params, js + "\nreturn install();")(...args);
  return api;
}

it("workflow completion stays owned by the work it was started from, even after switching work (QC-13)", async () => {
  const api = await build(
    workflowCode,
    `return {
      setSelectedWorkId: (id) => { selectedWorkId = id; },
      setActive: (id) => { workflowStreamActive = id; },
      setOrigin: (id) => { workflowStreamOrigin = id; },
      setSeq: (n) => { currentRunSeq = n; },
      setRunning: (n) => { runningWorkflow = n; },
      handleWorkflowStreamEvent,
      getActive: () => workflowStreamActive,
      getRunning: () => runningWorkflow,
      getError: () => workflowError,
      getIds: () => executionWorkIds,
      getNames: () => executionWorkflowNames,
    };`,
    [
      "window", "workflowStreamActive", "workflowStreamState", "workflowStreamOrigin",
      "runningWorkflow", "currentRunSeq", "cancelWorkflow",
      "executionWorkflowNames", "executionWorkIds", "selectedWorkId",
      "workflowError", "sphereState",
      "renderWorkDetail", "renderEvidence", "setSphereState", "setLoomReachable",
      "refreshExecutionsList", "pollWorkflowExecution", "isLoomConnectionError",
    ],
    [
      { setTimeout: vi.fn() },
      null, null, null,
      null, 0, false,
      new Map(), new Map(), null,
      null, "idle",
      vi.fn(), vi.fn(), vi.fn(), vi.fn(),
      vi.fn(async () => {}), vi.fn(async () => {}),
      vi.fn((e: Error) => /ECONNREFUSED|Loom is unavailable/i.test(String(e))),
    ],
  );

  api.setSelectedWorkId("w1");
  api.setOrigin("w1");
  api.setSeq(7);
  api.setRunning("build");
  api.setActive("wf-1");
  api.handleWorkflowStreamEvent({ requestId: "wf-1", kind: "progress", event: { executionId: "ex-9", progress: 40, message: "doing" } });
  // The human switches work while the run is still streaming.
  api.setSelectedWorkId("w2");
  api.handleWorkflowStreamEvent({ requestId: "wf-1", kind: "done" });
  await new Promise((r) => setTimeout(r, 0));

  expect(api.getIds().get("ex-9")).toBe("w1");
  expect(api.getNames().get("ex-9")).toBe("build");
  expect(api.getActive()).toBeNull();
});

it("workflow stream errors keep the real workflow name and clear state after capture", async () => {
  const api = await build(
    workflowCode,
    `return {
      setSeq: (n) => { currentRunSeq = n; },
      setRunning: (n) => { runningWorkflow = n; },
      setActive: (id) => { workflowStreamActive = id; },
      handleWorkflowStreamEvent,
      getError: () => workflowError,
      getRunning: () => runningWorkflow,
    };`,
    [
      "window", "workflowStreamActive", "workflowStreamState", "workflowStreamOrigin",
      "runningWorkflow", "currentRunSeq", "cancelWorkflow",
      "executionWorkflowNames", "executionWorkIds", "selectedWorkId",
      "workflowError", "sphereState",
      "renderWorkDetail", "renderEvidence", "setSphereState", "setLoomReachable",
      "refreshExecutionsList", "pollWorkflowExecution", "isLoomConnectionError",
    ],
    [
      { setTimeout: vi.fn() },
      null, null, null,
      null, 0, false,
      new Map(), new Map(), null,
      null, "idle",
      vi.fn(), vi.fn(), vi.fn(), vi.fn(),
      vi.fn(async () => {}), vi.fn(async () => {}),
      vi.fn((e: Error) => /ECONNREFUSED|Loom is unavailable/i.test(String(e))),
    ],
  );

  api.setSeq(1);
  api.setRunning("ship-report");
  api.setActive("wf-2");
  api.handleWorkflowStreamEvent({ requestId: "wf-2", kind: "error", error: "step failed" });
  await new Promise((r) => setTimeout(r, 0));
  const err = api.getError();
  expect(err).toContain("ship-report");
  expect(err).toContain("step failed");
  expect(api.getRunning()).toBeNull();
});

it("changing sessions cancels the old subscription and clearing cancels too (QC-17)", async () => {
  const cancelLoomStream = vi.fn(async () => {});
  const sessionSubscribe = vi.fn(async () => {});
  const refreshSessionDetail = vi.fn(async () => {});
  const api = await build(
    sessionCode,
    `return {
      setSelectedSessionId: (id) => { selectedSessionId = id; },
      ensureSessionSubscription, handleSessionEvent,
      getSubId: () => sessionSubId,
    };`,
    ["isTauri", "sessionSubId", "selectedSessionId", "cancelLoomStream", "sessionSubscribe", "refreshSessionDetail"],
    [true, null, null, cancelLoomStream, sessionSubscribe, refreshSessionDetail],
  );

  api.setSelectedSessionId("a");
  await api.ensureSessionSubscription();
  expect(sessionSubscribe).toHaveBeenCalledWith("sess-a", "a");
  expect(cancelLoomStream).not.toHaveBeenCalled();

  api.setSelectedSessionId("b");
  await api.ensureSessionSubscription();
  expect(cancelLoomStream).toHaveBeenCalledWith("sess-a");
  expect(sessionSubscribe).toHaveBeenCalledWith("sess-b", "b");

  // A stale terminal from the old subscription must not clear the new one.
  api.handleSessionEvent({ requestId: "sess-a", kind: "error", error: "closed" });
  expect(api.getSubId()).toBe("sess-b");

  api.setSelectedSessionId(null);
  await api.ensureSessionSubscription();
  expect(cancelLoomStream).toHaveBeenCalledWith("sess-b");
  expect(api.getSubId()).toBeNull();
});

it("re-ensuring the same session does not re-subscribe", async () => {
  const cancelLoomStream = vi.fn(async () => {});
  const sessionSubscribe = vi.fn(async () => {});
  const api = await build(
    sessionCode,
    `return {
      setSelectedSessionId: (id) => { selectedSessionId = id; },
      ensureSessionSubscription,
      getSubId: () => sessionSubId,
    };`,
    ["isTauri", "sessionSubId", "selectedSessionId", "cancelLoomStream", "sessionSubscribe", "refreshSessionDetail"],
    [true, null, null, cancelLoomStream, sessionSubscribe, vi.fn(async () => {})],
  );
  api.setSelectedSessionId("a");
  await api.ensureSessionSubscription();
  await api.ensureSessionSubscription();
  expect(sessionSubscribe).toHaveBeenCalledTimes(1);
});

it("decodes the flat camelCase ABTestEvent with string int64 latency", async () => {
  const renderAbtest = vi.fn();
  const api = await build(
    abtestCode,
    `return {
      setState: (s) => { abtestState = s; },
      handleAbtestEvent,
      getState: () => abtestState,
    };`,
    ["abtestState", "renderAbtest"],
    [null, renderAbtest],
  );

  const state: any = { requestId: "ab-1", per: new Map(), winner: null, error: null };
  api.setState(state);
  api.handleAbtestEvent({ requestId: "ab-1", kind: "progress", event: { providerName: "p1", contentChunk: "hello " } });
  expect(state.per.get("p1")?.text).toBe("hello ");

  api.handleAbtestEvent({
    requestId: "ab-1",
    kind: "progress",
    event: { providerName: "p1", finished: true, score: 0.9, latencyMs: "1234", costUsd: 0.0041 },
  });
  expect(state.per.get("p1").latencyMs).toBe(1234);
  expect(state.per.get("p1").costUsd).toBe(0.0041);

  api.handleAbtestEvent({ requestId: "ab-1", kind: "progress", event: { winner: "p1" } });
  expect(state.winner).toBe("p1");
  expect(renderAbtest).toHaveBeenCalled();

  // Events for another request must not touch this state.
  api.handleAbtestEvent({ requestId: "other", kind: "progress", event: { providerName: "p2", contentChunk: "x" } });
  expect(state.per.has("p2")).toBe(false);
});
