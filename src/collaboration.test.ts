import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

async function render({ known = true, reachable = true, failed = false, agents = [] as any[] } = {}) {
  const element = () => ({
    textContent: "", className: "", children: [] as any[], handlers: {} as Record<string, () => void>,
    append(...items: any[]) { this.children.push(...items); },
    replaceChildren() { this.children = []; },
    setAttribute: vi.fn(),
    addEventListener(type: string, handler: () => void) { this.handlers[type] = handler; },
  });
  const host = element();
  const document = { getElementById: () => host, createElement: element };
  const start = source.indexOf("function renderCollaboration()");
  const { code } = await transformWithOxc(source.slice(start, source.indexOf("function renderInspectorSessionDetail()", start)), "collaboration-check.ts");
  const setMode = vi.fn(), openAgentDetail = vi.fn();
  new Function("document", "loomStatusKnown", "loomReachable", "agentsLoadError", "agents", "setMode", "openAgentDetail", code + "\nrenderCollaboration();")(
    document, known, reachable, failed, agents, setMode, openAgentDetail,
  );
  return { host, setMode, openAgentDetail };
}

it("distinguishes loading, offline, failed and empty agent activity", async () => {
  for (const [options, expected] of [
    [{ known: false }, "Checking"], [{ reachable: false }, "offline"],
    [{ failed: true }, "unavailable"], [{}, "No agents are registered"],
  ] as const) {
    const { host } = await render(options);
    expect(host.children[0].textContent).toContain(expected);
  }
});

it("shows server facts as inert text and opens the actual agent detail", async () => {
  const { host, setMode, openAgentDetail } = await render({ agents: [{ id: "a1", name: "<script>fixture</script>", status: "running", active_sessions: 2, error: "" }] });
  const row = host.children[0];
  const [name, detail] = row.children[1].children;
  expect(name.textContent).toBe("<script>fixture</script>");
  expect(detail.textContent).toBe("running · 2 active sessions");
  name.handlers.click();
  expect(setMode).toHaveBeenCalledWith("agents");
  expect(openAgentDetail).toHaveBeenCalledWith("a1");
  expect(row.children[1].children).toHaveLength(2);
});
