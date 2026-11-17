# Markdown editors evaluation — what the harness IDE can actually use

Evaluated against: the Tauri + vanilla-TypeScript IDE, the markdown vault
(`Research Vault/` behind the store adapter), and the standing rule — one
decision per new dependency, Eduardo decides. Source article:
<https://opensource.com/article/18/11/markdown-editors> (Nov 2018).

## The four editors

| Editor | Stack | License | Embeddable in Tauri/vanilla-TS? | What to copy |
| --- | --- | --- | --- | --- |
| **Ghostwriter** | C++/Qt desktop app | GPL-3.0 | No | Format menu; task lists; session stats/focus mode; **export breadth** (HTML5/ODT/EPUB/LaTeX/PDF via pandoc/discount) |
| **Abricotine** | Electron (JavaScript) | GPL-3.0 | No (whole app) | **16 pre-packaged GFM table templates** + insert menu; inline image/link/math rendering |
| **Mark Text** | Electron | MIT | No (whole app) | **Semi-WYSIWYG editing model** (type markdown, see it render) — the strongest UX reference; GFM tables + code highlighting; image display |
| **Remarkable** | Python/PyGTK desktop app | MIT | No | Live preview pane with themeable CSS (11 themes + custom CSS) |

Comments in the article add ReText (Qt), StackEdit (web, AGPL), Marxico,
SimpleNote and Markor (Android); Typora is named but is not open source.
None of them change the verdict below.

## The honest verdict

**None of the four can be embedded in the harness IDE.** They are
standalone desktop applications in Qt, Electron or Python — dropping one
into a Tauri window would mean a second app inside the app, which breaks
the philosophy's own rule (§10: "no second app"). What they contribute is
a list of concrete features the IDE's Notes editor is missing, each
implementable in the existing stack.

## What the IDE's Notes editor has today

A plain `<textarea>` with a line-by-line "Edit / Preview" toggle that only
understands `## ` headings (everything else renders as a paragraph). That
is the gap these editors point at: **no real preview, no formatting
shortcuts, no tables, no task lists, no export.**

## Recommended improvements, cheapest first

1. **Formatting toolbar + GFM table templates — zero dependencies.**
   Insert buttons (bold, italic, heading, link, image, list, quote) and
   Abricotine's 16-table idea (a table-format picker that inserts a
   pre-formatted GFM table). Direct copy of Ghostwriter's Format menu and
   Abricotine's Insert menu. No new package; plain DOM + textarea
   selection manipulation.
2. **Real preview + export — one tiny MIT renderer.**
   Replace the line-by-line preview with a real markdown renderer
   (`markdown-it` or `marked`, MIT, ~tens of kB) so headings, lists,
   tables, task lists and code blocks render properly; add "Export as
   HTML" from the rendered output (Remarkable's HTML export, Ghostwriter's
   breadth reduced to the honest minimum). One dependency decision.
3. **Task lists — zero dependencies.**
   Render `- [ ]` / `- [x]` as checkboxes in the preview (Ghostwriter's
   task-list feature); the vault's review workflow already wants this.
4. **CodeMirror 6 for the Notes editor — one dependency decision.**
   Already the registered lighter-editor candidate in
   `docs/01-design-philosophy.md`; with Monaco now owning Code mode,
   CodeMirror (markdown language package, GFM tables, list continuation)
   is the natural Notes editor. It also makes a real diff view possible
   for vault notes.
5. **Semi-WYSIWYG (Mark Text's model) — the long-term north star.**
   ProseMirror-based (Milkdown, MIT, or bare ProseMirror). The heaviest
   option and the one that most rewards waiting; the vault's frontmatter
   + review metadata means the editor must preserve YAML headers exactly,
   which a WYSIWYG layer complicates. Defer until 1–4 prove themselves.

## Licensing notes

- Ghostwriter and Abricotine are GPL-3.0 — irrelevant as embeds, fine as
  feature references (ideas are not copyrightable; code is not copied).
- Mark Text and Remarkable are MIT — Mark Text is the closest
  architectural reference without copyleft concerns.
- The embeddable candidates above are all MIT (`markdown-it`, `marked`,
  CodeMirror 6, Milkdown/ProseMirror).

## Decisions to record

Add to `docs/DECISIONS.md`:
- Notes editor preview renderer: `markdown-it` vs `marked` vs none
  (dependency decision).
- Notes editor upgrade: CodeMirror 6 vs keep the textarea (dependency
  decision, companion to the Monaco decision).
- Milkdown/ProseMirror semi-WYSIWYG: defer (no decision needed yet).
