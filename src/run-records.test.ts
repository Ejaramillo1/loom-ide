import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// Exercises the real run-record store: corrupt bytes are retained (never
// silently replaced with empty data), records cap and persist, and the
// recorded total only sums runs that actually carry a server cost.

const storeCode = source.slice(
  source.indexOf("const RUNS_KEY ="),
  source.indexOf("function renderChatMessages("),
);

async function build(raw: string | null = null) {
  const storage = new Map<string, string>();
  if (raw !== null) storage.set("loom-ide-tauri:runs", raw);
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
  };
  const addChatError = vi.fn();
  const { code } = await transformWithOxc(
    `function install() {
      ${storeCode}
      return { loadRunRecords, recordRun, recordedTotalUsd, getRecords: () => runRecords };
    }`,
    "run-records-check.ts",
  );
  const api = new Function("localStorage", "addChatError", code + "\nreturn install();")(
    localStorage,
    addChatError,
  );
  return { api, storage, addChatError };
}

const base = (over: Record<string, unknown> = {}) => ({
  workId: "w1",
  intentId: null,
  sessionId: "sess-1",
  agentId: "agent-2",
  status: "succeeded",
  partial: false,
  startedAt: 1000,
  ...over,
});

it("preserves corrupt bytes under a backup key instead of silently replacing them with empty data", async () => {
  const corrupt = '{"runs": not-json';
  const { api, storage } = await build(corrupt);
  api.loadRunRecords();
  expect(api.getRecords().length).toBe(0);
  expect(storage.get("loom-ide-tauri:runs-corrupt")).toBe(corrupt);
});

it("appends run records, persists them, and caps the store", async () => {
  const { api, storage } = await build();
  api.loadRunRecords();
  for (let i = 0; i < 205; i++) {
    api.recordRun(base({ status: "succeeded" }));
  }
  expect(api.getRecords().length).toBe(200);
  const saved = JSON.parse(storage.get("loom-ide-tauri:runs") as string);
  expect(saved.length).toBe(200);
  expect(saved[199].status).toBe("succeeded");
});

it("the recorded total sums only runs with a numeric server cost", async () => {
  const { api } = await build();
  api.loadRunRecords();
  api.recordRun(base({ costUsd: 0.0042 }));
  api.recordRun(base({ costUsd: 0.0018 }));
  api.recordRun(base({ costUsd: null, status: "failed" }));
  expect(api.recordedTotalUsd()).toBeCloseTo(0.006, 10);
});

it("missing cost is unknown, never counted as zero spend", async () => {
  const { api } = await build();
  api.loadRunRecords();
  api.recordRun(base({ costUsd: null }));
  expect(api.getRecords()[0].costUsd).toBeNull();
  expect(api.recordedTotalUsd()).toBe(0);
});
