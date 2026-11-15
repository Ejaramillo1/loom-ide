import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// Exercise the existing imperative pane/router code without booting integrations or a browser.
async function shell(width: number) {
  const paneCode = source.slice(source.indexOf("let rightTab: RightTab"), source.indexOf("// Agents view —"));
  const routeCode = source.slice(source.indexOf("function setMode(next: Mode)"), source.indexOf("// File canvas. Legacy"));
  const railCode = source.slice(source.indexOf('  $("#spatial-knowledge").hidden = mode'), source.indexOf('  $("#left-close").addEventListener'));
  const views = ["spatial", "work", "experiment", "code", "agents", "evidence", "artifacts", "knowledge"];
  const nodes = new Map<string, any>();
  let active: any = null;
  const node = (id: string) => {
    if (!nodes.has(id)) {
      const classes = new Set<string>();
      nodes.set(id, { id, dataset: {}, hidden: false, value: "", attrs: {} as Record<string, string>, handlers: {} as Record<string, (e: any) => void>,
        classList: { contains: (c: string) => classes.has(c), remove: (c: string) => classes.delete(c), add: (c: string) => classes.add(c), toggle: (c: string, on: boolean) => on ? classes.add(c) : classes.delete(c) },
        setAttribute(key: string, value: string) { this.attrs[key] = value; }, removeAttribute(key: string) { delete this.attrs[key]; },
        focus() { active = this; }, closest: () => null,
        addEventListener(type: string, fn: (e: any) => void) { this.handlers[type] = fn; },
      });
    }
    return nodes.get(id);
  };
  const buttons = views.map(v => { const b = node(`mode-${v}`); b.dataset.mode = v; return b; });
  const doc = { body: node("body"), get activeElement() { return active; }, getElementById: node,
    querySelector: (s: string) => s === ".search-wrap" ? null : s.startsWith(".mode-btn") ? buttons.find(b => s.includes(`"${b.dataset.mode}"`)) : node(s),
    querySelectorAll: () => buttons,
  };
  const loadChat = vi.fn();
  const { code } = await transformWithOxc(`
    function install() {
    let mode = "spatial", lastFocus = null;
    const ALL_VIEWS = ${JSON.stringify(views)};
    const knowledge = { refresh: () => Promise.resolve() };
    const closeMenus = () => {};
    ${paneCode}\n${routeCode}\n${railCode}
    applyRightPane();
    return { setMode, openRight, closeRight, closeDrawers, isRightDrawer, applyRightPane };
    }
  `, "pane-check.ts");
  const api = new Function("document", "window", "$", "loadChatForWork", "selectedWorkId", "selectedSessionId", code + "return install();")(doc,
    { matchMedia: (query: string) => ({ matches: width >= Number(query.match(/\d+/)![0]) }) }, (s: string) => node(s.slice(1)), loadChat, null, null);
  return { node, api, loadChat, active: () => active, click: (id: string) => node(id).handlers.click({ currentTarget: node(id) }) };
}

it("starts Spatial with conversation on desktop and restores the other modes' inspector state", async () => {
  const { node, api } = await shell(1280);
  expect(api.isRightDrawer()).toBe(false);
  expect(node("chat-panel").hidden).toBe(false);
  expect(node("body").classList.contains("right-hidden")).toBe(false);
  node("chat-text").value = "Unsent draft";
  api.setMode("code");
  expect(api.isRightDrawer()).toBe(true);
  expect(node("body").classList.contains("right-open")).toBe(false);
  api.openRight("context");
  api.setMode("work");
  expect(node("inspector-context").hidden).toBe(false);
  api.setMode("spatial");
  expect(node("chat-panel").hidden).toBe(false);
  expect(node("chat-text").value).toBe("Unsent draft");
  expect(node("scrim").hidden).toBe(true);
});

it("keeps narrow conversation and Knowledge drawers exclusive and returns focus on closing", async () => {
  const { node, api, click, active } = await shell(900);
  expect(node("body").classList.contains("right-open")).toBe(false);
  api.openRight("conversation", node("chat-toggle"));
  expect(active()).toBe(node("chat-text"));
  click("spatial-knowledge-toggle");
  expect(node("body").classList.contains("right-open")).toBe(false);
  expect(node("body").classList.contains("knowledge-open")).toBe(true);
  expect(active()).toBe(node("spatial-knowledge-close"));
  expect(node("scrim").hidden).toBe(false);
  api.closeDrawers();
  expect(active()).toBe(node("spatial-knowledge-toggle"));
  expect(node("scrim").hidden).toBe(true);
  click("spatial-knowledge-toggle");
  api.openRight("conversation", node("chat-toggle"));
  expect(node("body").classList.contains("knowledge-open")).toBe(false);
  api.closeDrawers();
  expect(active()).toBe(node("chat-toggle"));
});

it("hides the bench rail on other modes and preserves the wide inspector tab", async () => {
  const { node, api } = await shell(1600);
  api.setMode("agents");
  expect(node("spatial-knowledge").hidden).toBe(true);
  expect(node("inspector-context").hidden).toBe(false);
  api.openRight("conversation");
  api.setMode("spatial");
  api.setMode("knowledge");
  expect(node("chat-panel").hidden).toBe(false);
  expect(node("body").classList.contains("right-open")).toBe(false);
});
