import { listKnowledge, readKnowledge, createKnowledge, saveKnowledge, relateKnowledge, reviewKnowledge, archiveKnowledge, restoreKnowledge, exportKnowledgeCanvas, syncKnowledge,
  knowledgeSignature, saveCanvasLayout, loadCanvasLayout, listPatterns, getPattern, createPattern, loadPatterns,
  patternUpdatesStream, addSkill, classifySkill, bulkImportSkills,
  type KnowledgeListing, type KnowledgeNote, type KnowledgeEdge, type KnowledgeDetail, type KnowledgeAudit, type VaultSignature } from "./api";

type Tab = "graph" | "canvas" | "notes" | "patterns" | "skills" | "review" | "activity";
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

export function installKnowledge(navigate: () => void, pendingChanged: (count: number, failed: boolean) => void, onWatcherRefresh?: () => void) {
  const host = document.querySelector<HTMLElement>("#view-knowledge")!;
  const content = host.querySelector<HTMLElement>("#knowledge-content")!;
  const notice = host.querySelector<HTMLElement>("#knowledge-notice")!;
  const tabs = host.querySelector<HTMLElement>("#knowledge-tabs")!;
  const bell = document.querySelector<HTMLButtonElement>("#knowledge-bell")!;
  const dialog = document.querySelector<HTMLDialogElement>("#knowledge-dialog")!;
  const benchGraph = document.querySelector<HTMLElement>("#spatial-graph")!;
  const benchCanvas = document.querySelector<HTMLElement>("#spatial-canvas")!;
  const benchGraphTab = document.querySelector<HTMLButtonElement>("#spatial-tab-graph")!;
  const benchCanvasTab = document.querySelector<HTMLButtonElement>("#spatial-tab-canvas")!;
  let loadFailed = false;
  let data: KnowledgeListing | null = null;
  let tab: Tab = "graph", query = "", kind = "", folder = "";
  let focus: string | null = null;
  let showArchived = false;
  let benchTab: "graph" | "canvas" = "graph";
  let dirty = false, busy = false, loading = false;
  let request = 0;
  // Canvas positions persist behind the store adapter (app data dir), so
  // arrangements survive restarts — durable layout, not session-only.
  const positions = new Map<string, { x: number; y: number }>();
  let layoutLoaded = false;
  let layoutSaveTimer: number | null = null;
  /** The last vault signature the watcher saw; null until the first probe. */
  let lastSignature: VaultSignature | null = null;
  const showNotice = (text = "", error = false) => { notice.textContent = text; notice.hidden = !text; notice.classList.toggle("error", error); };
  const fail = (error: unknown) => { showNotice(String(error), true); };
  function changed() { if (data) { pendingChanged(data.pending, false); bell.textContent = `🔔 ${data.pending}`; bell.setAttribute("aria-label", `Memory garden: ${data.pending} pending proposals`); } }
  /** Persist canvas positions (debounced) — the durable-layout store. */
  function scheduleLayoutSave() {
    if (layoutSaveTimer !== null) clearTimeout(layoutSaveTimer);
    layoutSaveTimer = setTimeout(() => {
      layoutSaveTimer = null;
      const rows = [...positions.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
      void saveCanvasLayout(rows).catch(() => { /* layout save is best-effort */ });
    }, 800) as unknown as number;
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      data = await listKnowledge(); loadFailed = false; showNotice(); changed(); render();
      if (!layoutLoaded) {
        layoutLoaded = true;
        try {
          const saved = await loadCanvasLayout();
          for (const row of saved) positions.set(row.id, { x: row.x, y: row.y });
          renderBench();
        } catch {
          /* a missing or unreadable layout file is not an error state */
        }
      }
      try { lastSignature = await knowledgeSignature(); } catch { lastSignature = null; }
    }
    catch (error) { loadFailed = true; renderBench(); pendingChanged(data?.pending ?? 0, true); fail(error); if (!data) content.replaceChildren(el("p", "Knowledge is unavailable. Open the desktop app or retry loading the vault.", "knowledge-empty")); }
    finally { loading = false; }
  }
  /** The disk watcher: external edits to vault files appear without a
      manual refresh. Polls a cheap signature; a draft or open dialog
      always wins over the refresh. */
  const setIntervalFn = typeof window !== "undefined" && typeof window.setInterval === "function"
    ? window.setInterval.bind(window)
    : null;
  if (setIntervalFn) setIntervalFn(() => {
    if (document.hidden || busy || dirty || dialog.open) return;
    void knowledgeSignature().then((sig) => {
      if (!lastSignature) { lastSignature = sig; return; }
      if (sig.changed_at_ms !== lastSignature.changed_at_ms || sig.notes !== lastSignature.notes || sig.pending !== lastSignature.pending) {
        lastSignature = sig;
        void refresh();
        // External vault edits also feed the Unity bench (§5.4.1): the
        // shell re-pushes the bench's counts on watcher-driven refreshes.
        onWatcherRefresh?.();
      }
    }).catch(() => { /* watcher failures are silent; the refresh button still works */ });
  }, 3000);
  function empty(text: string) { content.append(el("p", text, "knowledge-empty")); }
  function openTab(next: Tab) { navigate(); tab = next; render(); }
  for (const [id, label] of [["graph", "Graph"], ["canvas", "Canvas"], ["notes", "Notes"], ["patterns", "Patterns"], ["skills", "Skills"], ["review", "Memory garden"], ["activity", "Activity"]] as const) {
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
  function renderBench() {
    const graphActive = benchTab === "graph";
    for (const [parent, active] of [[benchGraph, graphActive], [benchCanvas, !graphActive]] as const) {
      parent.replaceChildren();
      parent.hidden = !active;
      if (loadFailed || !data) parent.append(el("p", loadFailed
        ? "Vault unavailable. Open Knowledge to retry loading your notes."
        : "Loading your vault…", "knowledge-empty"));
    }
    for (const [btn, active] of [[benchGraphTab, graphActive], [benchCanvasTab, !graphActive]] as const) {
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    }
    if (loadFailed || !data) return;
    if (graphActive) renderGraph(benchGraph, true);
    else renderCanvas(benchCanvas, true);
  }
  function render() {
    renderBench();
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
      filters.append(kinds, folders, button("Experiment notes", () => { kind = "experiment"; render(); }), button("Decision notes", () => { kind = "decision"; render(); }), button(showArchived ? "Show active notes" : `Show archived (${data.archived.length})`, () => { showArchived = !showArchived; render(); })); content.append(filters);
      const source = showArchived ? data.archived : data.notes;
      const notes = matchingNotes(source, query, kind, folder);
      if (!notes.length) empty(showArchived ? "No archived notes." : data.notes.length ? "No notes match these filters. Clear the search or choose another kind." : "No notes yet. Use New note to begin.");
      for (const n of notes) content.append(noteButton(n));
      return;
    }
    if (tab === "canvas") { renderCanvas(); return; }
    if (tab === "patterns") { void renderPatterns(); return; }
    if (tab === "skills") { void renderSkills(); return; }
    renderGraph();
  }
  /** Loom's pattern library — one shelf of the knowledge surface, next to
      the user's vault. Patterns are HTTP-bound; the shelf also carries the
      create/load actions and lives updates (the backend's pattern stream
      refreshes the listing). */
  async function renderPatterns() {
    content.replaceChildren(el("p", "Loading Loom's patterns…", "knowledge-empty"));
    let patterns: unknown[] = [];
    try {
      patterns = await listPatterns();
    } catch (error) {
      content.replaceChildren();
      content.append(el("p", `Could not list Loom's patterns: ${String(error)} Start the Loom server and refresh.`, "knowledge-empty"));
      return;
    }
    const tools = el("div", "", "knowledge-tools");
    tools.append(
      button("New pattern", openPatternCreate, "btn ghost"),
      button("Load patterns", openPatternsLoad, "btn ghost"),
    );
    content.append(tools);
    if (!patterns.length) {
      content.append(el("p", "No patterns reported by Loom. Start the Loom server and refresh, or create one here.", "knowledge-empty"));
      return;
    }
    const rows: { name: string; raw: unknown }[] = patterns.map((p) => ({
      name: (p as { name?: string }).name ?? (p as { id?: string }).id ?? "(unnamed pattern)",
      raw: p,
    }));
    rows.sort((a, b) => a.name.localeCompare(b.name));
    for (const { name, raw } of rows) {
      const card = button("", () => { void openPattern(name, raw); }, "knowledge-card");
      const meta = raw as { domain?: string; description?: string; version?: string };
      const sub = [meta.domain, meta.version].filter(Boolean).join(" · ");
      card.append(el("strong", name));
      if (meta.description) card.append(el("span", String(meta.description).slice(0, 180)));
      if (sub) card.append(el("span", sub, "knowledge-review-label"));
      content.append(card);
    }
  }
  function openPatternCreate() {
    frame("New pattern");
    const name = el("input");
    name.required = true;
    name.setAttribute("aria-label", "Pattern name");
    name.placeholder = "Pattern name";
    const body = el("textarea");
    body.rows = 8;
    body.setAttribute("aria-label", "Pattern definition (JSON)");
    body.placeholder = "Pattern definition (JSON)";
    const error = dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!;
    dialog.append(name, body, button("Create pattern", async () => {
      let def: Record<string, unknown>;
      try {
        def = JSON.parse(body.value || "{}") as Record<string, unknown>;
      } catch {
        error.textContent = "The pattern definition is not valid JSON.";
        return;
      }
      def.name = name.value.trim();
      try {
        await createPattern(def);
        dialog.close();
        await refresh();
      } catch (e) {
        error.textContent = String(e);
      }
    }, "btn"));
  }
  function openPatternsLoad() {
    frame("Load patterns");
    const source = el("input");
    source.required = true;
    source.setAttribute("aria-label", "Pattern source");
    source.placeholder = "Directory or repository path on the server";
    const error = dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!;
    dialog.append(source, button("Load", async () => {
      try {
        await loadPatterns(source.value.trim());
        dialog.close();
        await refresh();
      } catch (e) {
        error.textContent = String(e);
      }
    }, "btn"));
  }
  /** Skills (100% HTTP): Loom has no list endpoint, so the shelf carries
      the honest surface — add a skill (inline SKILL.md), classify one, or
      bulk-import a directory on the server. */
  function renderSkills() {
    const intro = el("p", "Loom's skills are imported, added or classified — the server exposes no skill list to read. Import or add below; each action reports what the server said.", "knowledge-empty");
    content.append(intro);
    const addForm = el("div", "", "skills-form");
    const addH = el("h3", "Add a skill");
    const name = el("input");
    name.setAttribute("aria-label", "Skill name");
    name.placeholder = "Skill name (kebab-case)";
    const md = el("textarea");
    md.rows = 10;
    md.setAttribute("aria-label", "SKILL.md content");
    md.placeholder = "Full SKILL.md content, including frontmatter";
    const addBtn = button("Add skill", async () => {
      if (!name.value.trim() || !md.value.trim()) return;
      try {
        await addSkill({ name: name.value.trim(), skill_md: md.value });
        showNotice("Skill added.");
      } catch (e) {
        fail(e);
      }
    }, "btn");
    addForm.append(addH, name, md, addBtn);
    content.append(addForm);
    const classForm = el("div", "", "skills-form");
    classForm.append(el("h3", "Classify a skill"));
    const cname = el("input");
    cname.setAttribute("aria-label", "Skill name to classify");
    cname.placeholder = "Skill name";
    classForm.append(cname, button("Classify", async () => {
      if (!cname.value.trim()) return;
      try {
        const result = await classifySkill(cname.value.trim());
        showNotice(`Classified: ${JSON.stringify(result).slice(0, 200)}`);
      } catch (e) {
        fail(e);
      }
    }, "btn ghost"));
    content.append(classForm);
    const importForm = el("div", "", "skills-form");
    importForm.append(el("h3", "Bulk import"));
    const dir = el("input");
    dir.setAttribute("aria-label", "Source directory on the server");
    dir.placeholder = "/path/on/server/to/skills";
    importForm.append(dir, button("Import (streams progress)", async () => {
      if (!dir.value.trim()) return;
      try {
        await bulkImportSkills(`skills-${Date.now()}`, dir.value.trim());
        showNotice("Bulk import started — progress arrives as it runs.");
      } catch (e) {
        fail(e);
      }
    }, "btn ghost"));
    content.append(importForm);
  }
  async function openPattern(name: string, raw: unknown) {
    frame(name);
    try {
      const detail = await getPattern(name);
      const pre = el("pre", JSON.stringify(detail, null, 2), "pattern-detail");
      dialog.append(pre);
    } catch {
      // The list row still carries the summary; the detail fetch is best-effort.
      const pre = el("pre", JSON.stringify(raw, null, 2), "pattern-detail");
      dialog.append(pre);
    }
  }
  function svgNode(tag: string, attrs: Record<string, string>) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }
  function renderGraph(parent = content, compact = false) {
    if (!data) return;
    if (!data.notes.length) { parent.append(el("p", "No notes yet. Open Knowledge to create a note or sync from Loom.", "knowledge-empty")); return; }
    const nodes = graphLayout(data.notes, data.edges, focus);
    const edges = data.edges.filter(e => nodes.some(n => n.note.meta.id === e.from) && nodes.some(n => n.note.meta.id === e.to));
    const tools = el("div", "", "knowledge-tools"); tools.append(el("span", `${nodes.length} objects · ${edges.length} relationships`));
    if (focus) tools.append(button("Show all knowledge", () => { focus = null; render(); })); parent.append(tools);
    const svg = svgNode("svg", { viewBox: "0 0 900 560", class: "knowledge-graph", role: "group", "aria-label": "Knowledge graph" });
    const arrow = compact ? "bench-knowledge-arrow" : "knowledge-arrow";
    const defs = svgNode("defs", {}), marker = svgNode("marker", { id: arrow, markerWidth: "8", markerHeight: "8", refX: "7", refY: "4", orient: "auto" });
    marker.append(svgNode("path", { d: "M0,0 L8,4 L0,8 Z", fill: "var(--muted)" })); defs.append(marker); svg.append(defs);
    for (const edge of edges) {
      const a = nodes.find(n => n.note.meta.id === edge.from)!, b = nodes.find(n => n.note.meta.id === edge.to)!;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || 1;
      const line = svgNode("line", { x1: `${a.x + dx / distance * 21}`, y1: `${a.y + dy / distance * 21}`, x2: `${b.x - dx / distance * 24}`, y2: `${b.y - dy / distance * 24}`, stroke: "var(--muted)", "marker-end": `url(#${arrow})` });
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
    parent.append(svg);
  }
  function renderCanvas(parent = content, compact = false) {
    if (!data) return;
    if (!compact) parent.append(button("Export JSON Canvas", () => { void exportKnowledgeCanvas().then(path => showNotice(`Exported to ${path}`)).catch(fail); }));
    if (!data.notes.length) { parent.append(el("p", "No notes yet. Open Knowledge to begin your canvas.", "knowledge-empty")); return; }
    const stage = el("div", "", "knowledge-canvas"), plane = el("div", "", "knowledge-plane");
    // The compact preview keeps text at its real reading size; the plane
    // scrolls instead of shrinking (the old 0.62 scale made 13px text ~8px).
    const scale = 1;
    const bounds = el("div", "", "knowledge-canvas-bounds");
    bounds.append(plane);
    plane.style.transform = `scale(${scale})`;
    const lines = svgNode("svg", { class: "knowledge-lines", "aria-hidden": "true" }); plane.append(lines); stage.append(bounds); parent.append(stage);
    for (const [i, n] of data.notes.entries()) if (!positions.has(n.meta.id)) positions.set(n.meta.id, { x: (i % 4) * 240, y: Math.floor(i / 4) * 148 });
    function drawLines() {
      lines.replaceChildren();
      const ps = data!.notes.map(n => positions.get(n.meta.id)!);
      plane.style.width = `${Math.max(960, ...ps.map(p => p.x + 240))}px`; plane.style.height = `${Math.max(440, ...ps.map(p => p.y + 148))}px`;
      bounds.style.width = `${parseFloat(plane.style.width) * scale}px`;
      bounds.style.height = `${parseFloat(plane.style.height) * scale}px`;
      const ids = new Set(data!.notes.map(n => n.meta.id));
      for (const e of data!.edges) {
        const a = positions.get(e.from), b = positions.get(e.to); if (!a || !b || !ids.has(e.from) || !ids.has(e.to)) continue;
        lines.append(svgNode("line", { x1: `${a.x + 110}`, y1: `${a.y + 64}`, x2: `${b.x + 110}`, y2: `${b.y + 64}`, stroke: "var(--muted)" }));
      }
    }
    for (const n of data.notes) {
      const card = button("", () => { if (!moved) void openNote(n.meta.id); }, "knowledge-card knowledge-canvas-card");
      card.dataset.kind = kindColour(n.meta.kind);
      card.append(el("strong", n.meta.title), el("span", n.meta.kind));
      card.title = "Drag to move; arrow keys move the card; Enter opens the note";
      const p = positions.get(n.meta.id)!; let start: { x: number; y: number; left: number; top: number } | null = null, moved = false;
      const place = () => { card.style.left = `${p.x}px`; card.style.top = `${p.y}px`; }; place();
      card.addEventListener("pointerdown", e => { if (e.button !== 0) return; moved = false; start = { x: e.clientX, y: e.clientY, left: p.x, top: p.y }; card.setPointerCapture(e.pointerId); });
      card.addEventListener("pointermove", e => { if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; if (Math.hypot(dx, dy) > 4) moved = true; if (!moved) return; p.x = Math.max(0, start.left + dx / scale); p.y = Math.max(0, start.top + dy / scale); place(); drawLines(); });
      card.addEventListener("pointerup", () => { start = null; scheduleLayoutSave(); }); card.addEventListener("pointercancel", () => { start = null; });
      card.addEventListener("keydown", e => { const delta: Record<string, [number, number]> = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] }; if (delta[e.key]) { e.preventDefault(); p.x = Math.max(0, p.x + delta[e.key][0]); p.y = Math.max(0, p.y + delta[e.key][1]); place(); drawLines(); scheduleLayoutSave(); } else moved = false; });
      plane.append(card);
    }
    drawLines();
  }
  function close() { if (!busy && !dirty) dialog.close(); else dialog.querySelector<HTMLElement>(".knowledge-dialog-error")!.textContent = busy ? "Saving…" : "Save or discard your draft before closing."; }
  dialog.addEventListener("close", () => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active.closest("[hidden]")) tabs.querySelector<HTMLElement>(".active")?.focus();
  });
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
    const archived = note.meta.status === "archived";
    controls.append(button("Save", () => { if (!title.reportValidity()) return; void mutation(() => saveKnowledge({ ...note, meta: { ...note.meta, title: title.value, kind: kinds.value }, body: body.value }, detail.revision), () => { dialog.close(); void openNote(note.meta.id); }); }, "btn"), button("Discard", () => { if (!busy) { dirty = false; dialog.close(); } }), button("Focus in graph", () => { if (dirty) { close(); return; } dialog.close(); focus = note.meta.id; openTab("graph"); }), button(archived ? "Restore note" : "Archive note", () => { if (dirty) { close(); return; } if (!window.confirm(`${archived ? "Restore" : "Archive"} "${note.meta.title}"? The file is preserved on disk and this is reversible.`)) return; void mutation(() => archived ? restoreKnowledge(note.meta.id, note.original, detail.revision) : archiveKnowledge(note.meta.id, note.original, detail.revision), () => dialog.close()); }, "ghost")); dialog.append(controls);
    const provenance = el("details"); provenance.append(el("summary", "Source & provenance"), el("p", `Author: ${note.meta.author}\nStable ID: ${note.meta.id}\nCreated: ${time(note.meta.created)}\nModified: ${time(note.meta.modified)}\nFile: ${data!.root}/${note.path}\nSource: ${note.meta.source}`, "knowledge-provenance")); dialog.append(provenance);
    const connections = el("section"); connections.append(el("h3", "Connections & backlinks"));
    const edges = detail.edges;
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
  document.querySelector("#spatial-open-full")!.addEventListener("click", () => openTab(benchTab));
  benchGraphTab.addEventListener("click", () => { benchTab = "graph"; renderBench(); });
  benchCanvasTab.addEventListener("click", () => { benchTab = "canvas"; renderBench(); });
  renderBench();
  bell.addEventListener("click", () => openTab("review"));
  // Live pattern updates (§6.3.1): the shelf refreshes when Loom reports
  // pattern changes; the backend stream is best-effort (the browser
  // preview has no bridge, and a quiet failure costs nothing).
  void patternUpdatesStream("patterns-shelf").catch(() => { /* no bridge */ });
  void refresh();
  return { refresh, newNote, openNote, showNotes: () => openTab("notes"), search: (value: string) => { query = value; if (tab === "notes") render(); },
    searchResults: (value: string) => data ? matchingNotes(data.notes, value) : [], isDialogOpen: () => dialog.open };
}
