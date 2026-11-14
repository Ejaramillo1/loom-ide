import { listKnowledge, readKnowledge, createKnowledge, saveKnowledge, relateKnowledge, reviewKnowledge, exportKnowledgeCanvas, syncKnowledge,
  type KnowledgeListing, type KnowledgeNote, type KnowledgeEdge, type KnowledgeDetail, type KnowledgeAudit } from "./api";

type Tab = "graph" | "canvas" | "notes" | "review" | "activity";
export function matchingNotes(notes: KnowledgeNote[], query: string, kind = "", folder = "") {
  const q = query.trim().toLowerCase();
  return notes.filter(n => (!kind || n.meta.kind === kind) && (!folder || n.path.startsWith(`${folder}/`)) &&
    [n.meta.title, n.meta.kind, n.body].some(s => s.toLowerCase().includes(q)));
}
export function graphLayout(notes: KnowledgeNote[], edges: KnowledgeEdge[], focus: string | null) {
  const neighbours = new Set([focus]);
  if (focus) for (const e of edges) { if (e.from === focus) neighbours.add(e.to); if (e.to === focus) neighbours.add(e.from); }
  const visible = focus ? notes.filter(n => neighbours.has(n.meta.id)) : notes;
  const outer = visible.filter(n => n.meta.id !== focus);
  return visible.map(n => {
    const angle = outer.indexOf(n) / Math.max(outer.length, 1) * Math.PI * 2 - Math.PI / 2;
    return { note: n, x: n.meta.id === focus ? 450 : 450 + 320 * Math.cos(angle), y: n.meta.id === focus ? 280 : 280 + 205 * Math.sin(angle) };
  });
}
export function kindColour(kind: string) { return kind === "result" || kind === "memory" ? "green" : kind === "experiment" ? "blue" : kind === "question" ? "amber" : "purple"; }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") => {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};
function button(text: string, action: () => void, className = "btn ghost") {
  const b = el("button", text, className); b.type = "button"; b.addEventListener("click", action); return b;
}
function select(label: string, values: string[], value: string, all?: string) {
  const s = el("select"); s.setAttribute("aria-label", label);
  if (all) s.add(new Option(all, ""));
  for (const option of values) s.add(new Option(option, option));
  s.value = value; return s;
}
const time = (value: number) => new Date(value * 1000).toLocaleString();

export function installKnowledge(navigate: () => void, pendingChanged: (count: number, failed: boolean) => void) {
  const host = document.querySelector<HTMLElement>("#view-knowledge")!;
  const content = host.querySelector<HTMLElement>("#knowledge-content")!;
  const notice = host.querySelector<HTMLElement>("#knowledge-notice")!;
  const tabs = host.querySelector<HTMLElement>("#knowledge-tabs")!;
  const bell = document.querySelector<HTMLButtonElement>("#knowledge-bell")!;
  const dialog = document.querySelector<HTMLDialogElement>("#knowledge-dialog")!;
  let data: KnowledgeListing | null = null;
  let tab: Tab = "graph", query = "", kind = "", folder = "";
  let focus: string | null = null;
  let dirty = false, busy = false, loading = false;
  let request = 0;
  // shortcut: canvas positions last for this application session; persist only if durable layouts are requested.
  const positions = new Map<string, { x: number; y: number }>();
  const showNotice = (text = "", error = false) => { notice.textContent = text; notice.hidden = !text; notice.classList.toggle("error", error); };
  const fail = (error: unknown) => { showNotice(String(error), true); pendingChanged(data?.pending ?? 0, true); };
  function changed() { if (data) { pendingChanged(data.pending, false); bell.textContent = `🔔 ${data.pending}`; bell.setAttribute("aria-label", `Memory garden: ${data.pending} pending proposals`); } }
  async function refresh() {
    if (loading) return;
    loading = true;
    try { data = await listKnowledge(); showNotice(); changed(); render(); }
    catch (error) { fail(error); if (!data) content.replaceChildren(el("p", "Knowledge is unavailable. Open the desktop app or retry loading the vault.", "knowledge-empty")); }
    finally { loading = false; }
  }
  function empty(text: string) { content.append(el("p", text, "knowledge-empty")); }
  function openTab(next: Tab) { navigate(); tab = next; render(); }
  for (const [id, label] of [["graph", "Graph"], ["canvas", "Canvas"], ["notes", "Notes"], ["review", "Memory garden"], ["activity", "Activity"]] as const) {
    const b = button(label, () => openTab(id), "knowledge-tab"); b.dataset.tab = id; tabs.append(b);
  }
  function noteButton(note: KnowledgeNote, review = false) {
    const card = button("", () => { void openNote(note.meta.id); }, "knowledge-card");
    card.append(el("strong", note.meta.title), el("span", `${note.meta.kind} · v${note.meta.version} · ${note.meta.status}`));
    if (review) card.append(el("span", "Needs your review", "knowledge-review-label"), el("p", note.body.slice(0, 220)), el("span", "Inspect evidence & review"));
    return card;
  }
  function auditRows(entries: KnowledgeAudit[], parent: HTMLElement) {
    if (!entries.length) parent.append(el("p", "No activity yet. Create a note to begin.", "knowledge-empty"));
    for (const a of entries) {
      const row = el("article", "", "knowledge-audit");
      row.append(el("strong", `${a.action} · ${data?.notes.find(n => n.meta.id === a.object)?.meta.title ?? a.object}`), el("p", `${a.actor} · ${time(a.at)} · ${a.detail}`)); parent.append(row);
    }
  }
  function render() {
    for (const b of tabs.querySelectorAll<HTMLButtonElement>("button")) { b.classList.toggle("active", b.dataset.tab === tab); b.setAttribute("aria-pressed", String(b.dataset.tab === tab)); }
    document.querySelector<HTMLElement>("#knowledge-search-slot")!.hidden = tab !== "notes";
    content.replaceChildren();
    if (!data) { empty("Load your markdown vault to begin."); return; }
    if (tab === "activity") { auditRows(data.activity, content); return; }
    if (tab === "review") {
      const pending = data.notes.filter(n => n.meta.status === "proposed");
      if (!pending.length) { empty("No proposals need review. Open Notes to browse your knowledge."); content.append(button("Open Notes", () => openTab("notes"))); }
      for (const n of pending) content.append(noteButton(n, true));
      return;
    }
    if (tab === "notes") {
      const filters = el("div", "", "knowledge-tools");
      const kinds = select("Note kind", data.kinds, kind, "All kinds"), folders = select("Vault folder", data.folders, folder, "All folders");
      kinds.addEventListener("change", () => { kind = kinds.value; render(); }); folders.addEventListener("change", () => { folder = folders.value; render(); });
      filters.append(kinds, folders, button("Experiment notes", () => { kind = "experiment"; render(); }), button("Decision notes", () => { kind = "decision"; render(); })); content.append(filters);
      const notes = matchingNotes(data.notes, query, kind, folder);
      if (!notes.length) empty(data.notes.length ? "No notes match these filters. Clear the search or choose another kind." : "No notes yet. Use New note to begin.");
      for (const n of notes) content.append(noteButton(n));
      return;
    }
    if (tab === "canvas") { renderCanvas(); return; }
    renderGraph();
  }
  function svgNode(tag: string, attrs: Record<string, string>) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }
  function renderGraph() {
    if (!data) return;
    if (!data.notes.length) { empty("No notes yet. Use New note or Sync from Loom to build your graph."); return; }
    const nodes = graphLayout(data.notes, data.edges, focus);
    const edges = data.edges.filter(e => nodes.some(n => n.note.meta.id === e.from) && nodes.some(n => n.note.meta.id === e.to));
    const tools = el("div", "", "knowledge-tools"); tools.append(el("span", `${nodes.length} objects · ${edges.length} relationships`));
    if (focus) tools.append(button("Show all knowledge", () => { focus = null; render(); })); content.append(tools);
    const svg = svgNode("svg", { viewBox: "0 0 900 560", class: "knowledge-graph", role: "group", "aria-label": "Knowledge graph" });
    const defs = svgNode("defs", {}), marker = svgNode("marker", { id: "knowledge-arrow", markerWidth: "8", markerHeight: "8", refX: "7", refY: "4", orient: "auto" });
    marker.append(svgNode("path", { d: "M0,0 L8,4 L0,8 Z", fill: "var(--muted)" })); defs.append(marker); svg.append(defs);
    for (const edge of edges) {
      const a = nodes.find(n => n.note.meta.id === edge.from)!, b = nodes.find(n => n.note.meta.id === edge.to)!;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const line = svgNode("line", { x1: `${a.x + dx / distance * 21}`, y1: `${a.y + dy / distance * 21}`, x2: `${b.x - dx / distance * 24}`, y2: `${b.y - dy / distance * 24}`, stroke: "var(--muted)", "marker-end": "url(#knowledge-arrow)" });
      const title = svgNode("title", {}); title.textContent = edge.kind; line.append(title); svg.append(line);
    }
    for (const { note, x, y } of nodes) {
      const g = svgNode("g", { transform: `translate(${x},${y})`, tabindex: "0", role: "button", "aria-label": `Open ${note.meta.title}` });
      g.append(svgNode("circle", { r: "19", fill: `var(--theme-${kindColour(note.meta.kind)})` }));
      const text = svgNode("text", { y: "38", "text-anchor": "middle", fill: "var(--ink)" }); text.textContent = note.meta.title.length > 30 ? `${note.meta.title.slice(0, 29)}…` : note.meta.title; g.append(text);
      const title = svgNode("title", {}); title.textContent = note.meta.title; g.append(title);
      const open = () => { focus = note.meta.id; render(); void openNote(note.meta.id); };
      g.addEventListener("click", open); g.addEventListener("keydown", e => { if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") { e.preventDefault(); open(); } }); svg.append(g);
    }
    content.append(svg);
  }
  function renderCanvas() {
    if (!data) return;
    content.append(button("Export JSON Canvas", () => { void exportKnowledgeCanvas().then(path => showNotice(`Exported to ${path}`)).catch(fail); }));
    if (!data.notes.length) { empty("No notes yet. Use New note to begin your canvas."); return; }
    const stage = el("div", "", "knowledge-canvas"), plane = el("div", "", "knowledge-plane");
    const lines = svgNode("svg", { class: "knowledge-lines", "aria-hidden": "true" }); plane.append(lines); stage.append(plane); content.append(stage);
    for (const [i, n] of data.notes.entries()) if (!positions.has(n.meta.id)) positions.set(n.meta.id, { x: (i % 4) * 240, y: Math.floor(i / 4) * 148 });
    function drawLines() {
      lines.replaceChildren();
      const ps = data!.notes.map(n => positions.get(n.meta.id)!);
      plane.style.width = `${Math.max(960, ...ps.map(p => p.x + 240))}px`; plane.style.height = `${Math.max(440, ...ps.map(p => p.y + 148))}px`;
      for (const e of data!.edges) {
        const a = positions.get(e.from), b = positions.get(e.to); if (!a || !b) continue;
        lines.append(svgNode("line", { x1: `${a.x + 110}`, y1: `${a.y + 64}`, x2: `${b.x + 110}`, y2: `${b.y + 64}`, stroke: "var(--muted)" }));
      }
    }
    for (const n of data.notes) {
      const card = button("", () => { if (!moved) void openNote(n.meta.id); }, "knowledge-card knowledge-canvas-card");
      card.append(el("strong", n.meta.title), el("span", n.meta.kind));
      card.title = "Drag to move; arrow keys move the card; Enter opens the note";
      const p = positions.get(n.meta.id)!; let start: { x: number; y: number; left: number; top: number } | null = null, moved = false;
      const place = () => { card.style.left = `${p.x}px`; card.style.top = `${p.y}px`; }; place();
      card.addEventListener("pointerdown", e => { if (e.button !== 0) return; moved = false; start = { x: e.clientX, y: e.clientY, left: p.x, top: p.y }; card.setPointerCapture(e.pointerId); });
      card.addEventListener("pointermove", e => { if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.hypot(dx, dy) > 4) moved = true; if (!moved) return; p.x = Math.max(0, start.left + dx); p.y = Math.max(0, start.top + dy); place(); drawLines(); });
      card.addEventListener("pointerup", () => { start = null; }); card.addEventListener("pointercancel", () => { start = null; });
      card.addEventListener("keydown", e => { const delta: Record<string, [number, number]> = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] }; if (delta[e.key]) { e.preventDefault(); p.x = Math.max(0, p.x + delta[e.key][0]); p.y = Math.max(0, p.y + delta[e.key][1]); place(); drawLines(); } else moved = false; });
      plane.append(card);
    }
    drawLines();
  }
  function close() { if (!busy && !dirty) dialog.close(); else dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!.textContent = busy ? "Saving…" : "Save or discard your draft before closing."; }
  dialog.addEventListener("cancel", e => { e.preventDefault(); close(); });
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  function frame(title: string) {
    dirty = false; dialog.replaceChildren();
    const h = el("h2", title); h.id = "knowledge-dialog-title";
    const error = el("p", "", "knowledge-dialog-error"); error.setAttribute("role", "alert");
    dialog.append(h, error);
    const closeButton = button("Close", close); closeButton.classList.add("knowledge-close"); dialog.append(closeButton);
    if (!dialog.open) dialog.showModal();
    return error;
  }
  async function mutation(action: () => Promise<unknown>, onSuccess: () => Promise<void> | void) {
    if (busy) return; busy = true;
    const controls = [...dialog.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("button, input, textarea, select")];
    const disabled = controls.map(c => c.disabled); controls.forEach(c => c.disabled = true);
    try { await action(); dirty = false; await refresh(); busy = false; await onSuccess(); }
    catch (error) { dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!.textContent = `${String(error)} Your draft remains here.`; }
    finally { busy = false; controls.forEach((c,i) => c.disabled = disabled[i]); }
  }
  function editor(note?: KnowledgeNote) {
    const title = el("input"); title.value = note?.meta.title ?? ""; title.required = true; title.setAttribute("aria-label", "Note title"); title.placeholder = "Note title";
    const kinds = select("Note kind", data!.kinds, note?.meta.kind ?? "note");
    const body = el("textarea"); body.value = note?.body ?? ""; body.setAttribute("aria-label", "Note body"); body.rows = 12;
    for (const control of [title, kinds, body]) control.addEventListener("input", () => { dirty = true; });
    dialog.append(title, kinds, body); return { title, kinds, body };
  }
  async function newNote() {
    navigate();
    if (dialog.open) { close(); if (dialog.open) return; }
    if (!data) await refresh(); if (!data) return;
    frame("New note"); const revision = data.revision;
    const { title, kinds, body } = editor();
    const folders = select("Vault folder", data.folders, folder || "10 Fleeting Notes"); dialog.append(folders);
    kinds.addEventListener("change", () => { const destination: Record<string, string> = { experiment: "Experiments", decision: "Decisions", session: "Sessions", agent: "Agents", artifact: "Artifacts" }; folders.value = destination[kinds.value] ? `50 Projects/Agent Memory/${destination[kinds.value]}` : "10 Fleeting Notes"; });
    folders.addEventListener("change", () => { dirty = true; });
    dialog.append(button("Create note", () => { if (!title.reportValidity()) return; let id = ""; void mutation(async () => { id = await createKnowledge(title.value, body.value, kinds.value, folders.value, revision); }, () => { dialog.close(); void openNote(id); }); }, "btn"), button("Discard", () => { if (!busy) { dirty = false; dialog.close(); } })); title.focus();
  }
  async function openNote(id: string) {
    navigate();
    if (busy || dirty) { if (dialog.open) dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!.textContent = "Save or discard your draft before opening another note."; return; }
    const token = ++request;
    try { const detail = await readKnowledge(id); if (token !== request) return; showDetail(detail); }
    catch (error) { fail(error); }
  }
  function showDetail(detail: KnowledgeDetail) {
    const note = detail.note;
    frame(note.meta.title);
    dialog.append(el("p", `${note.meta.kind} · ${note.meta.status} · v${note.meta.version}`));
    const { title, kinds, body } = editor(note);
    const preview = el("div", "", "knowledge-preview"); preview.hidden = true;
    for (const line of note.body.split("\n")) preview.append(el(line.startsWith("## ") ? "h3" : "p", line.startsWith("## ") ? line.slice(3) : line));
    dialog.append(preview, button("Edit / Preview", () => { preview.hidden = !preview.hidden; body.hidden = !preview.hidden; if (!preview.hidden) { preview.replaceChildren(); for (const line of body.value.split("\n")) preview.append(el(line.startsWith("## ") ? "h3" : "p", line.startsWith("## ") ? line.slice(3) : line)); } }));
    const controls = el("div", "", "knowledge-tools");
    controls.append(button("Save", () => { if (!title.reportValidity()) return; void mutation(() => saveKnowledge({ ...note, meta: { ...note.meta, title: title.value, kind: kinds.value }, body: body.value }, detail.revision), () => { dialog.close(); void openNote(note.meta.id); }); }, "btn"), button("Discard", () => { if (!busy) { dirty = false; dialog.close(); } }), button("Focus in graph", () => { if (dirty) { close(); return; } dialog.close(); focus = note.meta.id; openTab("graph"); })); dialog.append(controls);
    const provenance = el("details"); provenance.append(el("summary", "Source & provenance"), el("p", `Author: ${note.meta.author}\nStable ID: ${note.meta.id}\nCreated: ${time(note.meta.created)}\nModified: ${time(note.meta.modified)}\nFile: ${note.path}\nSource: ${note.meta.source}`, "knowledge-provenance")); dialog.append(provenance);
    const connections = el("section"); connections.append(el("h3", "Connections & backlinks"));
    const edges = data!.edges.filter(e => e.from === note.meta.id || e.to === note.meta.id);
    if (!edges.length) connections.append(el("p", "No links yet. Choose evidence below to connect this note."));
    for (const edge of edges) {
      const incoming = edge.to === note.meta.id, other = incoming ? edge.from : edge.to;
      const label = `${incoming ? "←" : "→"} ${edge.kind} · ${data!.notes.find(n => n.meta.id === other)?.meta.title ?? other}`;
      const row = el("div", "", "knowledge-tools"); row.append(button(label, () => { void openNote(other); }), button("Remove link", () => { if (dirty) { close(); return; } void mutation(() => relateKnowledge(edge, true, detail.revision), () => { dialog.close(); void openNote(note.meta.id); }); })); connections.append(row);
    }
    const relation = select("Relation type", data!.relations, data!.relations[0]);
    const target = el("select"); target.setAttribute("aria-label", "Linked evidence or note");
    for (const n of data!.notes.filter(n => n.meta.id !== note.meta.id)) target.add(new Option(n.meta.title, n.meta.id));
    const link = button("Link note", () => { if (dirty) { close(); return; } void mutation(() => relateKnowledge({ from: note.meta.id, to: target.value, kind: relation.value }, false, detail.revision), () => { dialog.close(); void openNote(note.meta.id); }); }); link.disabled = !target.options.length;
    connections.append(relation, target, link); dialog.append(connections);
    if (note.meta.status === "proposed") {
      const section = el("section"); section.append(el("h3", "Review the wording and linked evidence before accepting"));
      const reason = el("textarea"); reason.rows = 2; reason.placeholder = "Review reason"; reason.setAttribute("aria-label", "Review reason");
      section.append(reason);
      for (const approved of [true, false]) {
        const b = button(approved ? "Approve memory" : "Reject proposal", () => { if (dirty) { close(); return; } void mutation(() => reviewKnowledge(note.meta.id, approved, reason.value, note.original, detail.revision), () => { dialog.close(); }); });
        b.disabled = approved && !edges.length; section.append(b);
      }
      section.append(el("p", edges.length ? "Human decision · preserved in history" : "Link evidence before approval.")); dialog.append(section);
    }
    const history = el("details"); history.append(el("summary", "Version history & review trail"));
    for (const version of detail.versions) { const entry = el("details"); entry.append(el("summary", `v${version.meta.version} · ${time(version.meta.modified)}`), el("pre", version.body)); history.append(entry); }
    if (!detail.versions.length) history.append(el("p", "No earlier versions."));
    auditRows(detail.audit, history); dialog.append(history);
  }
  host.querySelector("#knowledge-new")!.addEventListener("click", () => { void newNote(); });
  host.querySelector("#knowledge-refresh")!.addEventListener("click", () => { void refresh(); });
  host.querySelector("#knowledge-sync")!.addEventListener("click", async e => {
    const b = e.currentTarget as HTMLButtonElement; b.disabled = true;
    try { const count = await syncKnowledge(); await refresh(); showNotice(`Synced ${count} new notes from Loom.`); }
    catch (error) { await refresh(); fail(error); } finally { b.disabled = false; }
  });
  bell.addEventListener("click", () => openTab("review"));
  void refresh();
  return { refresh, newNote, openNote, showNotes: () => openTab("notes"), search: (value: string) => { query = value; if (tab === "notes") render(); },
    searchResults: (value: string) => data ? matchingNotes(data.notes, value) : [], isDialogOpen: () => dialog.open };
}
