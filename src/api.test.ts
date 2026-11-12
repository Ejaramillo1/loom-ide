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

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    throw new Error("no Tauri in tests");
  }),
}));

import {
  AUTONOMY_LEVELS,
  addWorkItem,
  createIntent,
  deleteIntent,
  evidenceKindLabel,
  getIntents,
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

  it("corrupt stored work falls back to empty instead of throwing", async () => {
    storage.setItem(WORK_KEY, "garbage{{{");
    expect(await getWorkItems()).toEqual([]);
  });
});
