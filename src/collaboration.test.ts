import { expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import source from "./main.ts?raw";

it("keeps Agents in its own view without a collaboration card or decorative avatar", () => {
  expect(indexHtml).not.toMatch(/collaboration-panel|collaboration-summary|collaboration-open|class="avatar"/);
  expect(source).not.toContain("renderCollaboration");
  expect(indexHtml).toContain('id="view-agents"');
  expect(indexHtml).toContain('data-workspace-mode="agents"');
});
