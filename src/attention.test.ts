import { expect, it, vi } from "vitest";
import { transformWithOxc } from "vite";
import source from "./main.ts?raw";

it("shows Attention for a real item and removes it again when the list clears", async () => {
  const element = () => ({
    hidden: true, textContent: "", children: [] as any[],
    handlers: {} as Record<string, () => void>,
    set innerHTML(_value: string) { this.children = []; },
    append(...items: any[]) { this.children.push(...items); },
    classList: { toggle: vi.fn() },
    addEventListener(type: string, handler: () => void) { this.handlers[type] = handler; },
  });
  const nodes = new Map<string, ReturnType<typeof element>>();
  const node = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id)!;
  };
  const start = source.indexOf("function renderAttention(");
  const { code } = await transformWithOxc(source.slice(start, source.indexOf("let attentionDialog:", start)), "attention-check.ts");
  const open = vi.fn();
  const render = new Function("document", "$", "openAttentionDialog", code + "\nreturn renderAttention;")(
    { getElementById: node, createElement: element }, (selector: string) => node(selector), open,
  );
  render([]);
  expect(node("#attention-panel").hidden).toBe(true);
  expect(node("#attention-list").children).toHaveLength(0);
  const item = { kind: "decision", title: "Fixture decision", detail: "Choose the next experiment" };
  render([item]);
  expect(node("#attention-panel").hidden).toBe(false);
  expect(node("#att-count").textContent).toBe("1");
  const button = node("#attention-list").children[0].children[0];
  button.handlers.click();
  expect(open).toHaveBeenCalledWith(item, button);
  render([]);
  expect(node("#attention-panel").hidden).toBe(true);
  expect(node("#attention-list").children).toHaveLength(0);
  expect(node("#att-count").textContent).toBe("0");
  expect(node("#chat-toggle").classList.toggle).toHaveBeenLastCalledWith("has-attention", false);
});
