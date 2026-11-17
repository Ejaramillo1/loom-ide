import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";
import indexHtml from "../index.html?raw";
import styleCss from "./style.css?raw";

// Exercise the existing imperative pane/router code without booting integrations or a browser.
async function shell(width: number) {
  const paneCode = source.slice(source.indexOf("let rightTab: RightTab"), source.indexOf("// Agents view —"));
  const routeCode = source.slice(source.indexOf("function setMode(next: Mode)"), source.indexOf("// File canvas. Legacy"));
  const views = ["spatial", "work", "experiment", "code", "agents", "artifacts", "knowledge"];
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
        style: { setProperty: () => {}, removeProperty: () => {} },
        getBoundingClientRect: () => ({ width: 320 }),
        setPointerCapture: () => {},
      });
    }
    return nodes.get(id);
  };
  const doc = { body: node("body"), get activeElement() { return active; }, getElementById: node,
    querySelector: (s: string) => (s === ".search-wrap" ? null : node(s)),
    querySelectorAll: () => [],
  };
  const loadChat = vi.fn();
  const { code } = await transformWithOxc(`
    function install() {
    let mode = "spatial", lastFocus = null;
    const ALL_VIEWS = ${JSON.stringify(views)};
    const knowledge = { refresh: () => Promise.resolve() };
    const closeMenus = () => {};
    ${paneCode}\n${routeCode}
    applyRightPane();
    return { setMode, openRight, closeRight, closeDrawers, isRightDrawer, applyRightPane,
      expandChatOnReply, resetRightColWidth, clampRightCol, rightColWidth: () => rightColWidth };
    }
  `, "pane-check.ts");
  const api = new Function("document", "window", "$", "loadChatForWork", "selectedWorkId", "selectedSessionId", code + "return install();")(doc,
    { innerWidth: width, matchMedia: (query: string) => ({ matches: width >= Number(query.match(/\d+/)![0]) }) }, (s: string) => node(s.slice(1)), loadChat, null, null);
  return { node, api, loadChat, active: () => active };
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

it("keeps the narrow conversation drawer exclusive and returns focus on closing", async () => {
  const { node, api, active } = await shell(900);
  expect(node("body").classList.contains("right-open")).toBe(false);
  api.openRight("conversation", node("chat-toggle"));
  expect(active()).toBe(node("chat-text"));
  expect(node("body").classList.contains("right-open")).toBe(true);
  expect(node("scrim").hidden).toBe(false);
  api.closeDrawers();
  expect(node("body").classList.contains("right-open")).toBe(false);
  expect(active()).toBe(node("chat-toggle"));
  expect(node("scrim").hidden).toBe(true);
});

it("keeps the inspector tab visible on other modes and the conversation on Spatial", async () => {
  const { node, api } = await shell(1600);
  api.setMode("agents");
  expect(node("inspector-context").hidden).toBe(false);
  api.openRight("conversation");
  api.setMode("spatial");
  api.setMode("knowledge");
  expect(node("chat-panel").hidden).toBe(false);
  expect(node("body").classList.contains("right-open")).toBe(false);
});

it("leaves no footer markup or mode-nav/mode-btn code anywhere", () => {
  for (const [name, text] of [["main.ts", source], ["index.html", indexHtml], ["style.css", styleCss]] as const) {
    expect(text, `${name} must not reference the removed footer`).not.toMatch(/app-footer|mode-nav|mode-btn/);
  }
});

it("offers Spatial first in the View menu", () => {
  const start = source.indexOf("const VIEW_MENU_MODES");
  expect(start).toBeGreaterThanOrEqual(0);
  const decl = source.slice(start, source.indexOf("] as const", start));
  expect(decl.replace(/\s+/g, "")).toContain('["spatial","code","experiment","work","agents","knowledge"');
});

it("widens the conversation panel once when a reply begins and resets on close", async () => {
  const { api } = await shell(1280);
  expect(api.rightColWidth()).toBeNull();
  expect(api.expandChatOnReply()).toBe(true);
  const expanded = api.rightColWidth();
  expect(expanded).toBeGreaterThan(304);
  expect(expanded).toBeLessThanOrEqual(768);
  // A second reply while still expanded does not re-trigger.
  expect(api.expandChatOnReply()).toBe(false);
  // Closing the panel returns it to the default width.
  api.closeRight();
  expect(api.rightColWidth()).toBeNull();
});

it("does not widen unless the conversation is open in the desktop column", async () => {
  const desktop = await shell(1280);
  desktop.api.openRight("context");
  expect(desktop.api.expandChatOnReply()).toBe(false);
  expect(desktop.api.rightColWidth()).toBeNull();

  const narrow = await shell(900);
  expect(narrow.api.isRightDrawer()).toBe(true);
  expect(narrow.api.expandChatOnReply()).toBe(false);
  expect(narrow.api.rightColWidth()).toBeNull();
});

it("clamps the column width to its supported range", async () => {
  const { api } = await shell(1280);
  expect(api.clampRightCol(100)).toBe(260);
  expect(api.clampRightCol(400)).toBe(400);
  expect(api.clampRightCol(5000)).toBe(768);
});
