import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// Exercise the real chat lifecycle code (sendChat / handleStreamEvent /
// finishStream / sendChatUnary) against a minimal fake DOM, so the
// issue-016 settle semantics are pinned by the actual implementation,
// not a re-implementation.

const el = (tag = "div") => {
  const classes = new Set<string>();
  const kids: any[] = [];
  const e: any = {
    tag,
    className: "",
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    type: "",
    placeholder: "",
    title: "",
    innerHTML: "",
    scrollTop: 0,
    scrollHeight: 0,
    dataset: {},
    attrs: {},
    handlers: {},
    children: kids,
    append(...items: any[]) {
      for (const item of items) {
        item.parent = e;
        kids.push(item);
      }
    },
    remove() {
      if (e.parent) {
        const i = e.parent.children.indexOf(e);
        if (i >= 0) e.parent.children.splice(i, 1);
        e.parent = null;
      }
    },
    classList: {
      contains: (c: string) => classes.has(c),
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
    },
    setAttribute(k: string, v: string) {
      e.attrs[k] = v;
    },
    addEventListener(type: string, fn: any) {
      e.handlers[type] = fn;
    },
    querySelector: () => el("span"),
  };
  return e;
};

type ChatStubs = {
  setLoomReachable: ReturnType<typeof vi.fn>;
  setSphereState: ReturnType<typeof vi.fn>;
  renderStatusPill: ReturnType<typeof vi.fn>;
  isLoomConnectionError: ReturnType<typeof vi.fn>;
  addChatError: ReturnType<typeof vi.fn>;
  addChatMessage: ReturnType<typeof vi.fn>;
  cacheChatMessage: ReturnType<typeof vi.fn>;
  refreshSessions: ReturnType<typeof vi.fn>;
  refreshAgents: ReturnType<typeof vi.fn>;
  setWorkSession: ReturnType<typeof vi.fn>;
  renderWorkList: ReturnType<typeof vi.fn>;
  renderSessionBar: ReturnType<typeof vi.fn>;
  loadWorkArtifacts: ReturnType<typeof vi.fn>;
  getLoomStatus: ReturnType<typeof vi.fn>;
  answerClarification: ReturnType<typeof vi.fn>;
  buildChatContext: ReturnType<typeof vi.fn>;
  askLoomStream: ReturnType<typeof vi.fn>;
  askLoom: ReturnType<typeof vi.fn>;
  recordRun: ReturnType<typeof vi.fn>;
};

function defaultStubs(): ChatStubs {
  return {
    setLoomReachable: vi.fn(),
    setSphereState: vi.fn(),
    renderStatusPill: vi.fn(),
    isLoomConnectionError: vi.fn((err: Error) =>
      /Loom is unavailable|Failed to fetch|NetworkError|ECONNREFUSED/i.test(String(err)),
    ),
    addChatError: vi.fn(),
    addChatMessage: vi.fn(),
    cacheChatMessage: vi.fn(),
    refreshSessions: vi.fn(async () => {}),
    refreshAgents: vi.fn(async () => {}),
    setWorkSession: vi.fn(async (id: string) => ({ id })),
    renderWorkList: vi.fn(),
    renderSessionBar: vi.fn(),
    loadWorkArtifacts: vi.fn(async () => {}),
    getLoomStatus: vi.fn(async () => ({ online: true })),
    answerClarification: vi.fn(async () => "accepted"),
    buildChatContext: vi.fn(() => ({ active_work: "w1" })),
    askLoomStream: vi.fn(() => new Promise<void>(() => {})),
    askLoom: vi.fn(async () => ({ text: "unary reply" })),
    recordRun: vi.fn(),
  };
}

async function shell(stubs: ChatStubs = defaultStubs()) {
  const nodes = new Map<string, any>();
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, el("div"));
    return nodes.get(id);
  };
  const document = {
    getElementById: node,
    createElement: el,
  };
  const window = { setTimeout: vi.fn() };
  const localStorage = { getItem: vi.fn(() => null), setItem: vi.fn() };

  const start = source.indexOf("/** The in-flight state of one streamed weave");
  const end = source.indexOf("// ---------------------------------------------------------------------------\n// Sessions + agents");
  const chatCode = source.slice(start, end);

  const { code } = await transformWithOxc(
    `function install() {
      ${chatCode}
      return {
        sendChat, handleStreamEvent, finishStream,
        getChatInFlight: () => chatInFlight,
        getActiveStreams: () => activeStreams,
        getActiveStreamId: () => activeStreamId,
        getLoomVerified: () => loomVerified,
        getSelectedSessionId: () => selectedSessionId,
        setSelectedWorkId: (id) => { selectedWorkId = id; },
        setSelectedSessionId: (id) => { selectedSessionId = id; },
        setSelectedAgentId: (id) => { selectedAgentId = id; },
      };
    }`,
    "chat-lifecycle-check.ts",
  );

  const api = new Function(
    "document", "window", "$", "localStorage",
    "loomVerified", "loomReconnecting", "sphereState",
    "chatInFlight", "activeStreamId", "activeStreamSessionId",
    "sessions", "workItems", "selectedWorkId", "selectedSessionId", "selectedAgentId", "activeIntentId",
    "UNASSIGNED_KEY", "CHAT_DRAFT_KEY",
    "setLoomReachable", "setSphereState", "renderStatusPill", "isLoomConnectionError",
    "addChatError", "addChatMessage", "cacheChatMessage",
    "refreshSessions", "refreshAgents", "setWorkSession",
    "renderWorkList", "renderSessionBar", "loadWorkArtifacts",
    "getLoomStatus", "answerClarification", "buildChatContext",
    "askLoomStream", "askLoom", "recordRun",
    code + "\nreturn install();",
  )(
    document, window, (sel: string) => node(sel.slice(1)), localStorage,
    false, false, "idle",
    0, null, null,
    [], [], null, null, null, null,
    "__unassigned", "draft-key",
    stubs.setLoomReachable, stubs.setSphereState, stubs.renderStatusPill, stubs.isLoomConnectionError,
    stubs.addChatError, stubs.addChatMessage, stubs.cacheChatMessage,
    stubs.refreshSessions, stubs.refreshAgents, stubs.setWorkSession,
    stubs.renderWorkList, stubs.renderSessionBar, stubs.loadWorkArtifacts,
    stubs.getLoomStatus, stubs.answerClarification, stubs.buildChatContext,
    stubs.askLoomStream, stubs.askLoom, stubs.recordRun,
  );
  return { api, stubs, node, window, localStorage };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

it("settles an early terminal event delivered before the invoke resolves (issue 016)", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  let resolveInvoke: () => void = () => {};
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>((r) => { resolveInvoke = r; });
  });
  const { api } = await shell(stubs);

  const pending = api.sendChat("hello");
  expect(api.getChatInFlight()).toBe(1);
  // The backend thread emitted its terminal while the invoke was still
  // awaiting — exactly the race issue 016 describes.
  api.handleStreamEvent({ requestId: sends[0], kind: "error", error: "Loom is unavailable at 127.0.0.1:5006. Start looms serve --http-port 5006." });
  expect(api.getChatInFlight()).toBe(0);
  resolveInvoke();
  await pending;

  expect(stubs.askLoom).not.toHaveBeenCalled();
  expect(stubs.addChatError).toHaveBeenCalled();
});

it("two overlapping sends settle independently and the counter never strands", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("first");
  void api.sendChat("second");
  expect(api.getChatInFlight()).toBe(2);

  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  await tick();
  expect(api.getChatInFlight()).toBe(1);

  api.handleStreamEvent({ requestId: sends[1], kind: "cancelled" });
  await tick();
  expect(api.getChatInFlight()).toBe(0);
});

it("a repeated terminal event settles once and never double-decrements", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  await tick();
  expect(api.getChatInFlight()).toBe(0);
  const loomCaches = stubs.cacheChatMessage.mock.calls.filter((c: any[]) => c[1] === "loom");
  expect(loomCaches.length).toBe(1);
  expect(stubs.refreshAgents).toHaveBeenCalledTimes(1);
});

it("captures work, session and agent at send time and never adopts the newest session at completion", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  api.setSelectedWorkId("w1");
  api.setSelectedSessionId("sess-1");
  api.setSelectedAgentId("agent-2");
  void api.sendChat("hello");
  expect(stubs.askLoomStream).toHaveBeenCalledWith(
    expect.any(String), "hello", "sess-1", "agent-2", expect.anything(),
  );

  // The human switches work and session while the reply is in flight.
  api.setSelectedWorkId("w2");
  api.setSelectedSessionId("sess-other");
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  await tick();
  // The reply belongs to the work it was sent from, not the selection.
  expect(stubs.cacheChatMessage).toHaveBeenCalledWith("w1", "loom", expect.any(String));
  // The work↔session link uses the captured pair, not the new selection.
  expect(stubs.setWorkSession).toHaveBeenCalledWith("w1", "sess-1");
});

it("without a captured session, completion reports the missing identity instead of guessing", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  await tick();
  expect(stubs.setWorkSession).not.toHaveBeenCalled();
  expect(api.getActiveStreams().size).toBe(0);
});

it("a start rejection falls back to unary exactly once and never strands the counter", async () => {
  const stubs = defaultStubs();
  stubs.askLoomStream = vi.fn(async () => { throw new Error("Enter a message first."); });
  stubs.askLoom = vi.fn(async () => ({ text: "unary reply", session_id: "sess-1" }));
  const { api } = await shell(stubs);

  await api.sendChat("hello");
  expect(api.getChatInFlight()).toBe(0);
  expect(stubs.askLoom).toHaveBeenCalledTimes(1);
  expect(stubs.addChatMessage).toHaveBeenCalledWith("loom", "unary reply", expect.anything());
});

it("skips the unary fallback when a terminal already settled before the rejection", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  let rejectInvoke: (e: Error) => void = () => {};
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>((_, rej) => { rejectInvoke = rej; });
  });
  const { api } = await shell(stubs);

  const pending = api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  rejectInvoke(new Error("ipc failure"));
  await pending;
  expect(stubs.askLoom).not.toHaveBeenCalled();
  expect(api.getChatInFlight()).toBe(0);
});

it("keeps partial replies on error, marks them partial, and never overwrites a newer human draft", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api, node, localStorage } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "progress", event: { partial_content: "Hel" } });
  // The human typed something new while the request was in flight.
  node("chat-text").value = "newer human draft";
  api.handleStreamEvent({ requestId: sends[0], kind: "error", error: "boom" });
  await tick();

  expect(stubs.cacheChatMessage).toHaveBeenCalledWith("__unassigned", "loom", "Hel");
  expect(node("chat-text").value).toBe("newer human draft");
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(api.getChatInFlight()).toBe(0);
});

it("restores the failed draft only when the composer is still empty", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api, node, localStorage } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "error", error: "boom" });
  expect(node("chat-text").value).toBe("hello");
  expect(localStorage.setItem).toHaveBeenCalledWith("draft-key", "hello");
});

it("a validation rejection is not treated as a disconnection (no re-probe, no offline flip)", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api, window } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({
    requestId: sends[0],
    kind: "error",
    error: "rpc error: code = FailedPrecondition desc = session belongs to a different agent",
  });
  expect(stubs.setLoomReachable).not.toHaveBeenCalledWith(false);
  expect(window.setTimeout).not.toHaveBeenCalled();
  expect(api.getChatInFlight()).toBe(0);
});

it("a cancelled turn settles, keeps the partial note path, and goes idle", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({ requestId: sends[0], kind: "progress", event: { partial_content: "par" } });
  api.handleStreamEvent({ requestId: sends[0], kind: "cancelled" });
  expect(api.getChatInFlight()).toBe(0);
  expect(stubs.setSphereState).toHaveBeenCalledWith("idle");
});

it("writes exactly one run record per terminal and passes the stream cost (no double-charge)", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("hello");
  api.handleStreamEvent({
    requestId: sends[0],
    kind: "progress",
    event: { partial_content: "done text", cost: { total_cost_usd: 0.0042 } },
  });
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  api.handleStreamEvent({ requestId: sends[0], kind: "done" });
  await tick();
  expect(stubs.recordRun).toHaveBeenCalledTimes(1);
  expect(stubs.recordRun).toHaveBeenCalledWith(
    expect.objectContaining({ status: "succeeded", partial: false, costUsd: 0.0042 }),
  );
});

it("records cancelled and failed outcomes with partial flags", async () => {
  const stubs = defaultStubs();
  const sends: string[] = [];
  stubs.askLoomStream = vi.fn((requestId: string) => {
    sends.push(requestId);
    return new Promise<void>(() => {});
  });
  const { api } = await shell(stubs);

  void api.sendChat("first");
  api.handleStreamEvent({ requestId: sends[0], kind: "progress", event: { partial_content: "par" } });
  api.handleStreamEvent({ requestId: sends[0], kind: "cancelled" });
  expect(stubs.recordRun).toHaveBeenCalledWith(
    expect.objectContaining({ status: "cancelled", partial: true }),
  );

  void api.sendChat("second");
  api.handleStreamEvent({ requestId: sends[1], kind: "error", error: "boom" });
  expect(stubs.recordRun).toHaveBeenCalledWith(
    expect.objectContaining({ status: "failed", partial: false, error: "boom" }),
  );
});
