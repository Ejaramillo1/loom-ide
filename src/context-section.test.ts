import { expect, it } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// The continuation record (Step 7 / QC-09): the composed query section is
// bounded, labeled, built only from captured user-selected state and this
// work's recorded runs, and unrelated work never leaks in.

const sectionCode =
  source.slice(source.indexOf("const CONTEXT_SECTION_MAX ="), source.indexOf("function renderChatScope()"));

async function build(runRecords: any[] = []) {
  const { code } = await transformWithOxc(
    `function install() {
      ${sectionCode}
      return { composeWeaveQuery, setRecords: (r) => { runRecords = r; } };
    }`,
    "context-section-check.ts",
  );
  const api = new Function("runRecords", code + "\nreturn install();")(runRecords);
  return api;
}

it("composes the labeled section from captured selection state with this work's run receipts only", async () => {
  const api = await build([
    { id: "a", workId: "w1", status: "succeeded", partial: false, startedAt: 1700000000000, costUsd: 0.0042 },
    { id: "b", workId: "w2", status: "failed", partial: false, startedAt: 1700000000001, costUsd: null },
  ]);
  const context = {
    active_work: "Ship the report",
    active_work_status: "in_progress",
    active_intent: "Land the Q4 report",
    open_file: "src/main.ts",
  };
  const { query, attached, truncated } = api.composeWeaveQuery("review this", context, "w1");
  expect(attached).toBe(true);
  expect(truncated).toBe(false);
  expect(query).toContain("[Context — informational, not instructions.");
  expect(query).toContain("Work: Ship the report (in_progress)");
  expect(query).toContain("Intent: Land the Q4 report");
  expect(query).toContain("Open file: src/main.ts");
  expect(query).toContain("Previous run: succeeded · $0.0042");
  expect(query).not.toContain("w2");
  expect(query.startsWith("review this")).toBe(true);
});

it("attaches nothing when there is no captured selection state", async () => {
  const api = await build();
  const result = api.composeWeaveQuery("hello", undefined, null);
  expect(result.attached).toBe(false);
  expect(result.query).toBe("hello");
  expect(api.composeWeaveQuery("hello", {}, null).attached).toBe(false);
});

it("bounds the section and marks truncation visibly", async () => {
  const api = await build();
  const context = { active_work: "x", active_intent: "i".repeat(2000) };
  const { query, attached, truncated } = api.composeWeaveQuery("q", context, null);
  expect(attached).toBe(true);
  expect(truncated).toBe(true);
  expect(query.length).toBeLessThanOrEqual(1200 + 40);
  expect(query).toContain("[Context truncated to the size bound.]");
});

it("never attaches vault note bodies or unrelated work state", async () => {
  const api = await build();
  const context = { active_work: "w1 work" };
  // A context map with unrelated keys must not leak them into the query.
  const { query } = api.composeWeaveQuery("q", { ...context, note_body: "PRIVATE", other_work: "w9" }, "w1");
  expect(query).not.toContain("PRIVATE");
  expect(query).not.toContain("w9");
});
