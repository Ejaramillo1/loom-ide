// Tests for the api.ts browser fallback (localStorage) path and the pure
// helpers. Runs under vitest in a node environment: `window` is undefined,
// so IN_TAURI is false and every command takes the localStorage fallback.
// The @tauri-apps/api/core import is mocked so the real package is never
// loaded, and localStorage is an in-memory stub reset before each test.
//
// These tests mirror the backend rules in src-tauri/src/store.rs on
// purpose: the fallback is a second implementation of the same contract
// (version bumps, justification on raise, delete-refuses-when-referenced),
// so the two must agree. Where they disagree, the test asserts the
// backend's rule (see the parity notes below).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    throw new Error("no Tauri in tests");
  }),
}));

import {
  AUTONOMY_LEVELS,
  addWorkItem,
  askLoom,
  createIntent,
  deleteIntent,
  evidenceKindLabel,
  getIntents,
  getLoomStatus,
  getWorkItems,
  setActiveIntent,
  setIntentAcceptance,
  setWorkAutonomy,
  setWorkSession,
  setWorkStatus,
  updateIntent,
} from "./api";

const WORK_KEY = "loom-ide-tauri:work-items";
const INTENTS_KEY = "loom-ide-tauri:intents";

function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
    _data: data,
  };
}

let storage = makeLocalStorage();

beforeEach(() => {
  storage = makeLocalStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("evidenceKindLabel", () => {
  it("labels all four kinds", () => {
    expect(evidenceKindLabel("observed")).toBe("Observed");
    expect(evidenceKindLabel("recorded")).toBe("Recorded");
    expect(evidenceKindLabel("inferred")).toBe("Inferred");
    expect(evidenceKindLabel("unknown")).toBe("Unknown");
  });
});

describe("AUTONOMY_LEVELS", () => {
  it("orders the four levels least to most permissive, no L5", () => {
    expect(AUTONOMY_LEVELS).toEqual([
      "manual",
      "assisted",
      "collaborative",
      "delegated",
    ]);
  });
});

describe("intents (localStorage fallback)", () => {
  it("create sets defaults and the first intent becomes active", async () => {
    const intent = await createIntent({
      statement: "  Ship v1  ",
      why: "  because users need it  ",
      acceptance: [{ text: " Done ", done: false }, { text: "", done: true }],
    });
    expect(intent.statement).toBe("Ship v1");
    expect(intent.why).toBe("because users need it");
    expect(intent.acceptance).toEqual([{ text: "Done", done: false }]);
    expect(intent.autonomy).toBe("collaborative");
    expect(intent.status).toBe("active");
    expect(intent.version).toBe(1);
    expect(intent.history).toEqual([]);
    expect(intent.autonomy_history).toEqual([]);
    const list = await getIntents();
    expect(list.active_intent_id).toBe(intent.id);
    expect(list.intents).toHaveLength(1);
  });

  it("create rejects an empty statement, like the backend", async () => {
    await expect(createIntent({ statement: "   " })).rejects.toThrow(
      /cannot be empty/i,
    );
    expect((await getIntents()).intents).toHaveLength(0);
  });

  it("second intent does not become active", async () => {
    const first = await createIntent({ statement: "First" });
    await createIntent({ statement: "Second", autonomy: "manual" });
    expect((await getIntents()).active_intent_id).toBe(first.id);
  });

  it("update statement bumps version and snapshots the old one", async () => {
    const intent = await createIntent({ statement: "Old", why: "why" });
    const updated = await updateIntent({ id: intent.id, statement: "New" });
    expect(updated.version).toBe(2);
    expect(updated.statement).toBe("New");
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].version).toBe(1);
    expect(updated.history[0].statement).toBe("Old");
    expect(updated.history[0].why).toBe("why");
  });

  it("status-only update does not bump the version", async () => {
    const intent = await createIntent({ statement: "S" });
    const updated = await updateIntent({ id: intent.id, status: "done" });
    expect(updated.status).toBe("done");
    expect(updated.version).toBe(1);
    expect(updated.history).toHaveLength(0);
  });

  it("no-op update changes nothing", async () => {
    const intent = await createIntent({ statement: "S" });
    const same = await updateIntent({ id: intent.id });
    expect(same.version).toBe(1);
    expect(same.history).toHaveLength(0);
  });

  it("empty why clears it; empty statement keeps the current one", async () => {
    const intent = await createIntent({ statement: "S", why: "old why" });
    const cleared = await updateIntent({ id: intent.id, why: "" });
    expect(cleared.why).toBeNull();
    expect(cleared.version).toBe(2);
    const kept = await updateIntent({ id: intent.id, statement: "   " });
    expect(kept.statement).toBe("S");
  });

  it("raising autonomy requires a justification; lowering is instant", async () => {
    const intent = await createIntent({ statement: "S", autonomy: "manual" });
    await expect(
      updateIntent({ id: intent.id, autonomy: "delegated" }),
    ).rejects.toThrow(/justification/i);
    await expect(
      updateIntent({ id: intent.id, autonomy: "delegated", justification: "   " }),
    ).rejects.toThrow(/justification/i);
    const raised = await updateIntent({
      id: intent.id,
      autonomy: "delegated",
      justification: "the task is routine now",
    });
    expect(raised.autonomy).toBe("delegated");
    expect(raised.version).toBe(2);
    expect(raised.autonomy_history).toHaveLength(1);
    expect(raised.autonomy_history[0]).toMatchObject({
      from: "manual",
      to: "delegated",
      justification: "the task is routine now",
    });
    const lowered = await updateIntent({ id: intent.id, autonomy: "manual" });
    expect(lowered.autonomy).toBe("manual");
    expect(lowered.autonomy_history).toHaveLength(2);
    expect(lowered.autonomy_history[1].justification).toBeNull();
  });

  it("setIntentAcceptance does not bump the version", async () => {
    const intent = await createIntent({
      statement: "S",
      acceptance: [{ text: "Old", done: false }],
    });
    const updated = await setIntentAcceptance({
      id: intent.id,
      criteria: [
        { text: " New ", done: true },
        { text: "", done: false },
      ],
    });
    expect(updated.version).toBe(1);
    expect(updated.acceptance).toEqual([{ text: "New", done: true }]);
  });

  it("setActiveIntent switches; unknown id throws", async () => {
    const first = await createIntent({ statement: "First" });
    const second = await createIntent({ statement: "Second" });
    await setActiveIntent(second.id);
    expect((await getIntents()).active_intent_id).toBe(second.id);
    await expect(setActiveIntent("no-such-id")).rejects.toThrow(/Unknown intent/);
    await expect(setActiveIntent(first.id)).resolves.toBeDefined();
  });

  it("deleteIntent refuses when work references it and clears active", async () => {
    const a = await createIntent({ statement: "A" });
    const b = await createIntent({ statement: "B" });
    await addWorkItem("job", a.id);
    await expect(deleteIntent(a.id)).rejects.toThrow(/1 work item/);
    expect(await deleteIntent(b.id)).toBe(true);
    expect((await getIntents()).intents).toHaveLength(1);
    await expect(deleteIntent("no-such-id")).rejects.toThrow(/Unknown intent/);
  });

  it("corrupt stored intents fall back to empty instead of throwing", async () => {
    storage.setItem(INTENTS_KEY, "garbage{{{");
    expect(await getIntents()).toEqual({ active_intent_id: null, intents: [] });
  });
});

describe("work items (localStorage fallback)", () => {
  it("starts empty and persists newest first", async () => {
    expect(await getWorkItems()).toEqual([]);
    const a = await addWorkItem("First");
    const b = await addWorkItem("Second");
    const items = await getWorkItems();
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(b.id);
    expect(items[1].id).toBe(a.id);
  });

  it("auto-creates a one-line intent from the title when none exists", async () => {
    const item = await addWorkItem("Build the dial");
    expect(item.intent_id).toBeTruthy();
    const list = await getIntents();
    expect(list.intents).toHaveLength(1);
    expect(list.intents[0].statement).toBe("Build the dial");
    expect(list.active_intent_id).toBe(item.intent_id);
    expect(item.autonomy).toBe("collaborative");
  });

  it("uses the active intent, and an explicit intent wins", async () => {
    const active = await createIntent({ statement: "Active", autonomy: "manual" });
    const other = await createIntent({ statement: "Other", autonomy: "delegated" });
    const viaActive = await addWorkItem("job one");
    expect(viaActive.intent_id).toBe(active.id);
    expect(viaActive.autonomy).toBe("manual");
    const viaExplicit = await addWorkItem("job two", other.id);
    expect(viaExplicit.intent_id).toBe(other.id);
    expect(viaExplicit.autonomy).toBe("delegated");
  });

  it("setWorkAutonomy enforces the intent ceiling", async () => {
    const intent = await createIntent({ statement: "S", autonomy: "manual" });
    const item = await addWorkItem("job", intent.id);
    expect(item.autonomy).toBe("manual");
    await expect(setWorkAutonomy(item.id, "delegated")).rejects.toThrow(
      /allows at most/i,
    );
    const ok = await setWorkAutonomy(item.id, "manual");
    expect(ok.autonomy).toBe("manual");
  });

  it("setWorkAutonomy raising requires a justification", async () => {
    const intent = await createIntent({ statement: "S", autonomy: "delegated" });
    const item = await addWorkItem("job", intent.id);
    expect(item.autonomy).toBe("delegated");
    // Lower first so there is room to raise.
    const lowered = await setWorkAutonomy(item.id, "manual");
    expect(lowered.autonomy).toBe("manual");
    await expect(setWorkAutonomy(item.id, "delegated")).rejects.toThrow(
      /justification/i,
    );
    const raised = await setWorkAutonomy(item.id, "delegated", "routine now");
    expect(raised.autonomy).toBe("delegated");
    expect(raised.autonomy_history).toHaveLength(1);
    expect(raised.autonomy_history![0]).toMatchObject({
      from: "manual",
      to: "delegated",
      justification: "routine now",
    });
    // Lowering is instant and, like the backend command, records no
    // history entry (history is the record of granted freedom).
    const loweredAgain = await setWorkAutonomy(item.id, "manual");
    expect(loweredAgain.autonomy).toBe("manual");
    expect(loweredAgain.autonomy_history).toHaveLength(1);
  });

  it("setWorkStatus and setWorkSession update and persist", async () => {
    const item = await addWorkItem("job");
    const active = await setWorkStatus(item.id, "active");
    expect(active.status).toBe("active");
    const withSession = await setWorkSession(item.id, "sess-1");
    expect(withSession.session_id).toBe("sess-1");
    const reloaded = (await getWorkItems()).find((w) => w.id === item.id)!;
    expect(reloaded.status).toBe("active");
    expect(reloaded.session_id).toBe("sess-1");
  });

  it("records mutation times without inventing timestamps for old items", async () => {
    const legacy = {
      id: "legacy", title: "Existing work", status: "paused", autonomy: "manual",
      updated_label: "2h",
    };
    storage.setItem(WORK_KEY, JSON.stringify([legacy]));
    expect((await getWorkItems())[0].updated_at).toBeUndefined();
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    expect((await setWorkStatus("legacy", "active")).updated_at).toBe(1_800_000_000);
    vi.mocked(Date.now).mockReturnValue(1_800_000_060_000);
    const linked = await setWorkSession("legacy", " session-1 ");
    expect(linked.updated_at).toBe(1_800_000_060);
    expect(linked.session_id).toBe("session-1");
    expect((await setWorkSession("legacy", " ")).session_id).toBeNull();
  });

  it("rejects missing items and invalid local status without changing storage", async () => {
    const item = await addWorkItem("Existing work");
    const before = storage.getItem(WORK_KEY);
    await expect(setWorkStatus("missing", "active")).rejects.toThrow(/Unknown work item/);
    await expect(setWorkSession("missing", "session-1")).rejects.toThrow(/Unknown work item/);
    await expect(setWorkStatus(item.id, "done" as "active")).rejects.toThrow(/Unknown status/);
    expect(storage.getItem(WORK_KEY)).toBe(before);
  });

  it("reports failed local saves and preserves the last persisted state", async () => {
    const intent = await createIntent({ statement: "Original intent" });
    const item = await addWorkItem("Existing work", intent.id);
    const beforeWork = storage.getItem(WORK_KEY);
    const beforeIntents = storage.getItem(INTENTS_KEY);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("Storage quota exceeded");
    });
    await expect(setWorkStatus(item.id, "active")).rejects.toThrow(/Could not save work items/);
    await expect(setWorkAutonomy(item.id, "manual")).rejects.toThrow(/Could not save work items/);
    await expect(setWorkSession(item.id, "session-1")).rejects.toThrow(/Could not save work items/);
    await expect(updateIntent({ id: intent.id, statement: "Unsaved intent" }))
      .rejects.toThrow(/Could not save intents/);
    expect(storage.getItem(WORK_KEY)).toBe(beforeWork);
    expect(storage.getItem(INTENTS_KEY)).toBe(beforeIntents);
    expect((await getWorkItems())[0].status).toBe("paused");
  });

  it("validates titles and explicit intent references before creating work", async () => {
    await createIntent({ statement: "Existing intent" });
    await expect(addWorkItem(" ")).rejects.toThrow(/title cannot be empty/);
    await expect(addWorkItem("Job", "missing")).rejects.toThrow(/Unknown intent/);
    expect(await getWorkItems()).toEqual([]);
    expect((await addWorkItem("  Trimmed job  ")).title).toBe("Trimmed job");
  });

  it("corrupt stored work falls back to empty instead of throwing", async () => {
    storage.setItem(WORK_KEY, "garbage{{{");
    expect(await getWorkItems()).toEqual([]);
  });
});

describe("browser Loom response contract", () => {
  it("uses component health and reports degraded service without claiming health", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: "degraded",
      components: { provider: { status: "unhealthy", error: "Provider unavailable" } },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const status = await getLoomStatus();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/loom/v1/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(status.online).toBe(true);
    expect(status.detail).toContain("degraded");
    expect(status.detail).toContain("Provider unavailable");
  });

  it("does not claim health when the service reports failure or no health state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "unhealthy" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getLoomStatus()).online).toBe(false);
    expect((await getLoomStatus()).detail).toContain("health status was not reported");
    expect((await getLoomStatus()).online).toBe(false);
  });

  it("sends the verified gateway keys and retains the reply's session identity", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      text: "A server reply", sessionId: "session-returned",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reply = await askLoom("Question", "session-existing", "agent-1");
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/loom/v1/weave");
    expect(JSON.parse(request.body as string)).toEqual({
      query: "Question", sessionId: "session-existing", agentId: "agent-1",
    });
    expect(reply).toEqual({ text: "A server reply", source: "live", card: null, session_id: "session-returned" });
    expect(reply.evidenceKind).toBeUndefined();
  });

  it("rejects empty input and empty replies instead of fabricating a reply", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: " " }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(askLoom(" ")).rejects.toThrow(/Enter a message/);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(askLoom("Question")).rejects.toThrow(/empty response/);
  });
});
