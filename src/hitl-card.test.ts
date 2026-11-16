import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

// Exercises the real renderHitlCard code: approval/resource cards must be
// display-only (QC-07 — no network route to the stored-request store),
// question cards answer through the legacy clarification map with their
// question_id, and parameters render as inert text.

const el = (tag = "div") => {
  const classes = new Set<string>();
  const kids: any[] = [];
  const e: any = {
    tag,
    className: "",
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    type: "",
    placeholder: "",
    title: "",
    dataset: {},
    attrs: {},
    handlers: {},
    children: kids,
    append(...items: any[]) {
      for (const item of items) {
        item.parent = e;
        kids.push(item);
      }
    },
    remove() {
      if (e.parent) {
        const i = e.parent.children.indexOf(e);
        if (i >= 0) e.parent.children.splice(i, 1);
        e.parent = null;
      }
    },
    classList: {
      contains: (c: string) => classes.has(c),
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
    },
    setAttribute(k: string, v: string) {
      e.attrs[k] = v;
    },
    addEventListener(type: string, fn: any) {
      e.handlers[type] = fn;
    },
    querySelectorAll(sel: string) {
      const found: any[] = [];
      const walk = (n: any) => {
        for (const child of n.children) {
          if (child.tag === sel) found.push(child);
          walk(child);
        }
      };
      walk(e);
      return found;
    },
    querySelector: () => el("span"),
  };
  return e;
};

const codeSlice = source.slice(
  source.indexOf("function renderHitlCard("),
  source.indexOf("/** Settle one streamed request exactly once."),
);

async function build() {
  const { code } = await transformWithOxc(
    `function install() {
      ${codeSlice}
      return { renderHitlCard };
    }`,
    "hitl-card-check.ts",
  );
  const answerClarification = vi.fn(async () => "accepted");
  const respondHumanRequest = vi.fn(async () => ({ status: "approved" }));
  const refreshSessions = vi.fn(async () => {});
  const scrollChat = vi.fn();
  const document = { getElementById: () => el(), createElement: el };
  const api = new Function(
    "document", "scrollChat", "answerClarification", "respondHumanRequest", "refreshSessions", "activeStreamSessionId",
    code + "\nreturn install();",
  )(document, scrollChat, answerClarification, respondHumanRequest, refreshSessions, null);
  return { api, answerClarification, respondHumanRequest, refreshSessions };
}

function state(): any {
  return {
    workId: null,
    cacheKey: "__unassigned",
    msg: el("div"),
    bubble: el("div"),
    text: "",
    clean: "",
    toolLines: new Map(),
    clarifications: new Set(),
    sessionId: "sess-1",
    finished: false,
  };
}

const flatText = (node: any): string => {
  let out = node.textContent ?? "";
  for (const child of node.children) out += " " + flatText(child);
  return out;
};

it("approval cards answer through the gateway's stored-request route (QC-07)", async () => {
  const { api, respondHumanRequest, answerClarification } = await build();
  const st = state();
  api.renderHitlCard(st, {
    request_id: "req-1",
    kind: "approval",
    summary: "Run: git push --force",
    params_json: '{"tool":"git","args":{"flags":"--force"}}',
    timeout_seconds: 300,
  });
  const card = st.msg.children[0];
  const text = flatText(card);
  expect(text).toContain("git push --force");
  expect(text).toContain("expires after 300s");
  const approve = card.querySelectorAll("button").find((b: any) => b.textContent === "Approve");
  const deny = card.querySelectorAll("button").find((b: any) => b.textContent === "Deny");
  expect(approve).toBeTruthy();
  expect(deny).toBeTruthy();
  approve.handlers.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(respondHumanRequest).toHaveBeenCalledWith("req-1", "approved");
  expect(flatText(card)).toContain("hold is released");
  // The card-level guard: the other control is gone with the resolved card.
  expect(deny.hidden).toBe(true);
  // Never the legacy clarification map.
  expect(answerClarification).not.toHaveBeenCalled();
});

it("approval failures re-enable the card controls instead of allowing double submits (review #16)", async () => {
  const { api, respondHumanRequest } = await build();
  respondHumanRequest.mockRejectedValueOnce(new Error("older server: not found"));
  const st = state();
  api.renderHitlCard(st, { request_id: "req-2", kind: "approval", summary: "Run tool" });
  const card = st.msg.children[0];
  const approve = card.querySelectorAll("button").find((b: any) => b.textContent === "Approve");
  approve.handlers.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(flatText(card)).toContain("older server: not found");
  expect(approve.disabled).toBe(false);
});

it("resource holds are display-only too", async () => {
  const { api, answerClarification } = await build();
  const st = state();
  api.renderHitlCard(st, { request_id: "req-2", kind: "resource", summary: "Waiting on a lock" });
  const text = flatText(st.msg.children[0]);
  expect(text).toContain("can't be answered from the IDE");
  expect(answerClarification).not.toHaveBeenCalled();
});

it("question cards answer through the legacy map with the question_id, including option buttons", async () => {
  const { api, answerClarification } = await build();
  const st = state();
  api.renderHitlCard(st, {
    request_id: "store-9",
    question_id: "q-9",
    question: "Which branch?",
    options: ["main", "feature/x"],
  });
  const card = st.msg.children[0];
  const buttons = card.querySelectorAll("button");
  const main = buttons.find((b: any) => b.textContent === "main");
  expect(main).toBeTruthy();
  main.handlers.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(answerClarification).toHaveBeenCalledWith("sess-1", "q-9", "main");
  expect(flatText(card)).toContain("Answered — the agent continues");
});

it("question cards without a question_id are display-only", async () => {
  const { api, answerClarification } = await build();
  const st = state();
  api.renderHitlCard(st, { request_id: "req-3", question: "What now?" });
  const card = st.msg.children[0];
  const text = flatText(card);
  expect(text).toContain("carries no question_id");
  expect(card.querySelectorAll("button").length).toBe(0);
  expect(answerClarification).not.toHaveBeenCalled();
});

it("parameters are inert text and truncation is disclosed", async () => {
  const { api } = await build();
  const st = state();
  api.renderHitlCard(st, {
    request_id: "req-4",
    kind: "approval",
    summary: "Run tool",
    params_json: '{"tool":"deploy","env":"prod"}',
    params_truncated: true,
  });
  const card = st.msg.children[0];
  const pre = card.querySelectorAll("pre")[0];
  expect(pre).toBeTruthy();
  expect(pre.textContent).toContain("deploy");
  expect(flatText(card)).toContain("truncated the parameter list");
  // Nothing was parsed into live DOM: the params exist only as text.
  expect(card.querySelectorAll("script").length).toBe(0);
  expect(card.innerHTML).toBeUndefined();
});
