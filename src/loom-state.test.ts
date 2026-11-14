import { expect, it } from "vitest";
import { loomState } from "./loom-state";
it("keeps attention above processing, busy, input, completion and idle", () => {
  expect(loomState("attention", true, true, "draft", true)).toBe("attention");
  expect(loomState("error", true, true, "draft", true)).toBe("error");
  expect(loomState(null, true, true, "draft", true)).toBe("processing");
  expect(loomState(null, false, true, "draft", true)).toBe("executing");
  expect(loomState(null, false, false, "draft", true)).toBe("listening");
  expect(loomState(null, false, false, "  ", true)).toBe("completed");
  expect(loomState(null, false, false, "", false)).toBe("idle");
});
