import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";
import indexHtml from "../index.html?raw";

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
        contains: () => false,
        append(child: any) { child.parentElement = this; },
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

it("keeps other modes narrow conversation drawer exclusive and returns focus on closing", async () => {
  const { node, api, active } = await shell(900);
  api.setMode("code");
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

it("uses the sphere for Overview, preserves orbital shortcuts and removes the floating menu", () => {
  expect(indexHtml).toContain('id="overview-sphere"');
  expect(indexHtml).toContain('aria-label="Return to Overview"');
  expect(indexHtml).not.toMatch(/workspace-nav|workspace-navigation-slot/);
  const orbit = indexHtml.slice(indexHtml.indexOf('<nav class="orbital-nav"'), indexHtml.indexOf('</nav>', indexHtml.indexOf('<nav class="orbital-nav"')));
  expect([...orbit.matchAll(/>([^<>]+)<\/button>/g)].map(match => match[1])).toEqual(["Work", "Experiments", "Evidence", "Agents", "Knowledge", "Code"]);
  expect(source).toContain('$("#overview-sphere").addEventListener("click"');
});

it("keeps intent and autonomy inside Work without the Overview Work launcher", () => {
  const panel = indexHtml.slice(indexHtml.indexOf('<section class="work-panel"'), indexHtml.indexOf('</section>', indexHtml.indexOf('<section class="work-panel"')));
  expect(panel).toContain('class="intent-disclosure"');
  expect(panel).toContain('id="intent-header"');
  expect(indexHtml.match(/id="intent-header"/g)).toHaveLength(1);
  expect(indexHtml).not.toContain("spatial-work-open");
});

it("keeps chat and context visible together in Spatial, including narrow widths", async () => {
  for (const width of [390, 900, 1280, 1600]) {
    const { node, api } = await shell(width);
    const chat = node("chat-panel");
    expect(chat.parentElement).toBe(node("spatial-chat-slot"));
    expect(chat.hidden).toBe(false);
    expect(node("inspector-context").hidden).toBe(false);
    api.openRight("context");
    expect(chat.hidden).toBe(false);
    expect(api.expandChatOnReply()).toBe(false);
    api.setMode("code");
    expect(chat.parentElement).toBe(node("right-col"));
    api.setMode("spatial");
    expect(node("chat-panel")).toBe(chat);
    expect(chat.parentElement).toBe(node("spatial-chat-slot"));
  }
});

it("places the shared conversation beneath the sphere stage", () => {
  const overview = indexHtml.slice(indexHtml.indexOf('id="view-spatial"'), indexHtml.indexOf('id="view-experiment"'));
  expect(overview).toContain('class="spatial-stage"');
  expect(overview.indexOf('id="spatial-chat-slot"')).toBeGreaterThan(overview.indexOf('id="spatial-frame"'));
  expect(indexHtml.match(/id="spatial-chat-slot"/g)).toHaveLength(1);
});

it("offers Spatial first in the View menu", () => {
  const start = source.indexOf("const VIEW_MENU_MODES");
  expect(start).toBeGreaterThanOrEqual(0);
  const decl = source.slice(start, source.indexOf("] as const", start));
  expect(decl.replace(/\s+/g, "")).toContain('["spatial","code","experiment","work","agents","knowledge"');
});

it("widens other modes conversation once when a reply begins and resets on close", async () => {
  const { api } = await shell(1600);
  api.setMode("code");
  api.openRight("conversation");
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
  expect(narrow.api.isRightDrawer()).toBe(false);
  expect(narrow.api.expandChatOnReply()).toBe(false);
  expect(narrow.api.rightColWidth()).toBeNull();
});

it("clamps the column width to its supported range", async () => {
  const { api } = await shell(1280);
  expect(api.clampRightCol(100)).toBe(260);
  expect(api.clampRightCol(400)).toBe(400);
  expect(api.clampRightCol(5000)).toBe(768);
});

it("draft restoration never overwrites text entered while startup was pending", async () => {
  const start = source.indexOf("function restoreChatDraft()");
  const {code} = await transformWithOxc(source.slice(start,source.indexOf("function showChatHint()",start)),"draft-restore-check.ts");
  const input={value:""};
  const restore=new Function("$","localStorage","CHAT_DRAFT_KEY", code+";return restoreChatDraft;")(()=>input,{getItem:()=>"saved draft"},"draft");
  restore();
  expect(input.value).toBe("saved draft");
  input.value="new text";
  restore();
  expect(input.value).toBe("new text");
});
