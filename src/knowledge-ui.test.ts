import { afterEach, expect, it, vi } from "vitest";
import { installKnowledge } from "./knowledge";
import { listKnowledge, readKnowledge, archiveKnowledge, restoreKnowledge, type KnowledgeListing, type KnowledgeNote, type KnowledgeDetail } from "./api";

vi.mock("./api", () => ({ listKnowledge: vi.fn(), readKnowledge: vi.fn(), createKnowledge: vi.fn(), saveKnowledge: vi.fn(), relateKnowledge: vi.fn(), reviewKnowledge: vi.fn(), archiveKnowledge: vi.fn(), restoreKnowledge: vi.fn(), exportKnowledgeCanvas: vi.fn(), syncKnowledge: vi.fn() }));

// A small DOM double exercises the real renderers/handlers without a browser or new dependency.
class Node {
  children: Node[] = [];
  attrs: Record<string, string> = {};
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  events: Record<string, (event: any) => void> = {};
  className = ""; textContent = ""; id = ""; hidden = false; value = ""; open = false; disabled = false;
  options: Node[] = [];
  classList = { toggle: vi.fn(), add: vi.fn() };
  tag: string;
  constructor(tag = "div") { this.tag = tag; }
  append(...nodes: Node[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Node[]) { this.children = nodes; }
  setAttribute(key: string, value: string) { this.attrs[key] = value; if (key === "class") this.className = value; }
  addEventListener(type: string, handler: (event: any) => void) { this.events[type] = handler; }
  fire(type: string, args: Record<string, unknown> = {}) { this.events[type]?.({ preventDefault: vi.fn(), currentTarget: this, ...args }); }
  setPointerCapture() {}
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  add(option: Node) { this.options.push(option); }
  reportValidity() { return true; }
  all(): Node[] { return this.children.flatMap(n => [n, ...n.all()]); }
  querySelectorAll(selector: string): Node[] {
    return this.all().filter(n => selector.split(", ").some(s => s.startsWith("#") ? n.id === s.slice(1) : s.startsWith(".") ? n.className.split(" ").includes(s.slice(1)) : n.tag === s));
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  text(): string { return this.textContent + this.children.map(n => n.text()).join(" "); }
}
const note = (id: string): KnowledgeNote => ({ meta: { id, title: id, kind: "note", created: 1, modified: 1, author: "human", source: "test", status: "working", version: 1 }, body: "", path: `${id}.md`, original: "" });
const listing = (notes = [note("Alpha"), note("Beta")], archived: KnowledgeNote[] = []): KnowledgeListing => ({ notes, archived, edges: [{ from: "Alpha", to: "Beta", kind: "supports" }], activity: [], pending: 0, revision: "test", root: "/test", kinds: ["note"], folders: ["10 Fleeting Notes"], relations: ["supports"] });
async function mount(data = listing()) {
  const root = new Node();
  const ids = ["view-knowledge", "knowledge-content", "knowledge-notice", "knowledge-tabs", "knowledge-bell", "knowledge-dialog", "knowledge-search-slot", "knowledge-new", "knowledge-refresh", "knowledge-sync", "spatial-graph", "spatial-canvas", "spatial-open-graph", "spatial-open-canvas"];
  const nodes = Object.fromEntries(ids.map(id => { const n = new Node(); n.id = id; return [id, n]; }));
  root.append(nodes["view-knowledge"]);
  nodes["view-knowledge"].append(...ids.slice(1).map(id => nodes[id]));
  vi.stubGlobal("document", { querySelector: (s: string) => root.querySelector(s), createElement: (tag: string) => new Node(tag), createElementNS: (_: string, tag: string) => new Node(tag) });
  vi.stubGlobal("window", { addEventListener: vi.fn(), confirm: vi.fn(() => true) });
  vi.stubGlobal("Option", class extends Node { constructor(text: string, value: string) { super("option"); this.textContent = text; this.value = value; } });
  vi.mocked(listKnowledge).mockResolvedValue(data);
  const navigate = vi.fn();
  const instance = installKnowledge(navigate, vi.fn());
  await Promise.resolve();
  return { nodes, navigate, instance };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("renders the same vault notes and edges in both graphs and the bench canvas with unique arrows", async () => {
  const { nodes } = await mount();
  expect(listKnowledge).toHaveBeenCalledTimes(1);
  for (const id of ["knowledge-content", "spatial-graph"]) {
    expect(nodes[id].querySelectorAll("g")).toHaveLength(2);
    expect(nodes[id].querySelectorAll("line")).toHaveLength(1);
    expect(nodes[id].text()).toContain("Alpha");
  }
  expect(nodes["spatial-canvas"].querySelectorAll("button")).toHaveLength(2);
  expect(nodes["spatial-canvas"].querySelectorAll("line")).toHaveLength(1);
  const full = nodes["knowledge-content"].querySelector("marker")!.attrs.id;
  const compact = nodes["spatial-graph"].querySelector("marker")!.attrs.id;
  expect(full).not.toBe(compact);
  expect(nodes["spatial-graph"].querySelector("line")!.attrs["marker-end"]).toBe(`url(#${compact})`);
});

it("opens the full tools and retains canvas positions across the two surfaces", async () => {
  const { nodes, navigate } = await mount();
  const card = nodes["spatial-canvas"].querySelector("button")!;
  card.fire("pointerdown", { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
  card.fire("pointermove", { clientX: 62, clientY: 31 });
  card.fire("pointerup");
  expect(card.style.left).toBe("100px");
  expect(card.style.top).toBe("50px");
  card.fire("click");
  expect(readKnowledge).not.toHaveBeenCalled();
  nodes["spatial-open-canvas"].fire("click");
  expect(navigate).toHaveBeenCalledTimes(1);
  const full = nodes["knowledge-content"].querySelector(".knowledge-canvas-card")!;
  expect(full.style.left).toBe("100px");
  full.fire("keydown", { key: "ArrowRight" });
  expect(full.style.left).toBe("120px");
  nodes["spatial-open-graph"].fire("click");
  expect(nodes["spatial-canvas"].querySelector("button")!.style.left).toBe("120px");
  expect(nodes["knowledge-content"].querySelectorAll("g")).toHaveLength(2);
});

it("never invents content for an empty vault and replaces stale previews on a load failure", async () => {
  const { nodes, instance } = await mount(listing([]));
  for (const id of ["spatial-graph", "spatial-canvas"]) {
    expect(nodes[id].text()).toContain("No notes yet");
    expect(nodes[id].querySelectorAll("g")).toHaveLength(0);
  }
  vi.mocked(listKnowledge).mockResolvedValueOnce(listing()); await instance.refresh();
  expect(nodes["spatial-graph"].querySelectorAll("g")).toHaveLength(2);
  vi.mocked(listKnowledge).mockRejectedValueOnce(new Error("disk unavailable")); await instance.refresh();
  for (const id of ["spatial-graph", "spatial-canvas"]) {
    expect(nodes[id].text()).toContain("Vault unavailable");
    expect(nodes[id].querySelectorAll("g")).toHaveLength(0);
    expect(nodes[id].querySelectorAll(".knowledge-canvas-card")).toHaveLength(0);
  }
});

it("drops dangling canvas edges after a note disappears from the refreshed vault", async () => {
  const { nodes, instance } = await mount();
  vi.mocked(listKnowledge).mockResolvedValueOnce(listing([note("Alpha")])); await instance.refresh();
  expect(nodes["spatial-canvas"].querySelectorAll("line")).toHaveLength(0);
  expect(nodes["spatial-graph"].querySelectorAll("line")).toHaveLength(0);
});

it("routes preview notes through the shared editor and preserves a dirty draft", async () => {
  const { nodes, instance, navigate } = await mount();
  await instance.newNote();
  const dialog = nodes["knowledge-dialog"];
  const body = dialog.querySelector("textarea")!;
  body.value = "Unsent thought"; body.fire("input");
  nodes["spatial-graph"].querySelector("g")!.fire("keydown", { key: "Enter" });
  expect(navigate).toHaveBeenCalled();
  expect(readKnowledge).not.toHaveBeenCalled();
  expect(dialog.querySelector("textarea")!.value).toBe("Unsent thought");
  expect(dialog.text()).toContain("Save or discard your draft");
  dialog.fire("cancel");
  expect(dialog.open).toBe(true);
});

it("lists and restores archived notes without deleting files", async () => {
  const archived = { ...note("Old"), meta: { ...note("Old").meta, status: "archived" } };
  const detail: KnowledgeDetail = { note: archived, edges: [], versions: [], backlinks: [], audit: [], revision: "test" };
  vi.mocked(readKnowledge).mockResolvedValue(detail);
  const { nodes } = await mount(listing([note("Alpha")], [archived]));
  const notesTab = nodes["knowledge-tabs"].querySelectorAll("button").find(b => b.textContent === "Notes")!;
  notesTab.fire("click");
  expect(nodes["knowledge-content"].text()).toContain("Show archived (1)");
  expect(nodes["knowledge-content"].text()).not.toContain("Old");
  const toggle = nodes["knowledge-content"].querySelectorAll("button").find(b => b.textContent!.includes("Show archived"))!;
  toggle.fire("click");
  expect(nodes["knowledge-content"].text()).toContain("Old");
  const card = nodes["knowledge-content"].querySelectorAll(".knowledge-card").find(c => c.text().includes("Old"))!;
  card.fire("click");
  await new Promise(r => setTimeout(r, 0));
  const dialog = nodes["knowledge-dialog"];
  expect(dialog.text()).toContain("archived");
  const restore = dialog.querySelectorAll("button").find(b => b.textContent === "Restore note")!;
  expect(restore).toBeTruthy();
  restore.fire("click");
  expect(restoreKnowledge).toHaveBeenCalledWith("Old", "", "test");
});

it("archives a note through the shared dialog", async () => {
  const active = note("Alpha");
  vi.mocked(readKnowledge).mockResolvedValue({ note: active, edges: [], versions: [], backlinks: [], audit: [], revision: "test" });
  const { nodes } = await mount(listing([active]));
  nodes["knowledge-tabs"].querySelectorAll("button").find(b => b.textContent === "Notes")!.fire("click");
  const card = nodes["knowledge-content"].querySelectorAll(".knowledge-card").find(c => c.text().includes("Alpha"))!;
  card.fire("click");
  await new Promise(r => setTimeout(r, 0));
  const archive = nodes["knowledge-dialog"].querySelectorAll("button").find(b => b.textContent === "Archive note")!;
  expect(archive).toBeTruthy();
  archive.fire("click");
  expect(archiveKnowledge).toHaveBeenCalledWith("Alpha", "", "test");
});
