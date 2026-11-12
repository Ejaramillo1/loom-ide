# Obsidian architecture — and how to bring its features into Loom IDE

Analyzed 2026-11-11 with the Craft Anything REA toolset (clean-room + deep
static analysis of the installed snap). Target: **Obsidian 1.15.0**, snap
revision 72 at `/snap/obsidian/72` (the `current` link). This complements
`04-obsidian-look-and-feel.md` (the launcher's design tokens); this note
covers the **whole app's packaging and feature architecture**, then maps it
onto `loom-ide-tauri`.

Evidence ids (Craft Anything ledger): `ev_20d548d0…` (obsidian.asar app map),
`ev_0c248bf1…` (app.asar app map), `ev_777d1332…` (Electron fuses),
`ev_3b881846…` (asar inventory), `ev_1bdb50e8…` (IPC map),
`ev_219e8bbd…` (entry points).

---

## 1. How it is packaged

Obsidian is an **Electron app split into two ASAR bundles**:

| Bundle | Size | Role |
|---|---|---|
| `resources/app.asar` | 73 KB | Bootstrap + auto-updater |
| `resources/obsidian.asar` | 24 MB, 368 files | The actual application |
| `app/obsidian` | 224 MB | The Electron binary itself |

- `app.asar`'s `main.js` (`loadApp`, line ~300) dynamically `require()`s
  `obsidian.asar/main.js` at startup. It is the updater: it checks
  `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/desktop-releases.json`
  and `https://releases.obsidian.md/desktop-releases.json`, downloads
  `obsidian-<version>.asar`, verifies a **SHA-256 hash plus an RSA-SHA256
  signature** against a certificate embedded in `main.js`, then swaps the asar
  in place. `app.asar` also ships two native modules (`btime/binding.node`,
  `get-fonts/binding.node`).
- `obsidian.asar` is the real app: a single large renderer bundle plus a thin
  main process (see below).

## 2. Runtime architecture (obsidian.asar)

35 source files. The shape is **one thin Electron main process + one huge
renderer bundle + a few small satellite windows + two web workers**:

| File | Size | Role |
|---|---|---|
| `main.js` | 212 KB | Electron main process (windows, IPC, menus, updater, protocol) |
| `app.js` | 3.37 MB | The entire renderer UI/editor/logic (minified bundle) |
| `starter.js` + `starter.html` | 438 KB | Launcher/vault-chooser window |
| `help.js` + `help.html` | 389 KB | Help window |
| `quicklook.js` + `quicklook/index.html` | 675 KB | "Quick Look" preview window |
| `worker.js` | 250 KB | Web worker (vault metadata / search indexer) |
| `sim.js` | 18 KB | Web worker (simulation) |
| `i18n.js` | 134 KB | Internationalization |
| `enhance.js` | 13 KB | (image/text enhancement helper) |

- Two `BrowserWindow`s load `app://obsidian.md/index.html` through a custom
  `app://` protocol (registered in `main.js`). Their `webPreferences` are
  computed at runtime, so `nodeIntegration`/`contextIsolation`/`sandbox` could
  not be read statically — an open question.

### IPC surface (48 channels, 47 paired)

Almost all renderer→main traffic is **synchronous** (`ipcRenderer.sendSync` /
`ipcMain.on`), grouped as:

- **Vault**: `vault`, `vault-list`, `vault-open`, `vault-move`,
  `vault-remove`, `vault-message`, `get-default-vault-path`,
  `get-sandbox-vault-path`, `desktop-dir`, `documents-dir`
- **File / URL**: `open-file`, `open-url`, `request-url`, `file-url`
- **Menus / window**: `context-menu`, `render-menu`, `set-menu`,
  `update-menu-items`, `frame`, `relaunch`, `is-closing`, `is-quitting`,
  `starter`, `sandbox`
- **Settings**: `set-language`, `set-icon`, `get-icon`, `policy`, `terms`,
  `disable-gpu`, `disable-update`, `insider-build`
- **Update**: `check-update`, `latest-public-version`, `update`
- **Plugins**: `plugin-script-root`
- **Misc**: `print-to-pdf`, `copy-asar`, `create-browser-session`,
  `register-cli` (the `obsidian-cli` binary), `trash`, `help`,
  `adblock-frequency`, `adblock-lists`, `resources`

### Storage model

Persistence is almost entirely **localStorage** (settings, language, themes,
community-plugin/theme sort order, account, vault path, vim mode, spellcheck
languages) plus **IndexedDB** (the vault metadata cache) and a little
sessionStorage. There are **no native modules inside obsidian.asar** — all
filesystem access goes through the main process via IPC, not Node in the
renderer.

## 3. Feature libraries (the integration "goldmine")

Obsidian vendors its feature engines under `obsidian.asar/lib/`. These are
the concrete building blocks for the features Loom IDE wants:

| Feature | Library in Obsidian | Notes |
|---|---|---|
| Markdown editor | **CodeMirror 5** (`lib/codemirror/`, incl. `markdown.js`, `vim.js`, `modes.min.js`, `cm-addons.js`) | Live-preview editing |
| Math | **MathJax** (`lib/mathjax/obsidian-mathjax.js`, 1.1 MB) | KaTeX is a lighter alternative |
| PDF viewing | **PDF.js** (`lib/pdfjs/`, incl. worker + openjpeg wasm) | In-app PDF |
| Graph view | **PixiJS** (`lib/pixi.min.js`) | Canvas/WebGL link graph |
| Slides | **Reveal.js** (`lib/reveal/reveal.js`) | Presentation mode |
| Web clipper | **Mozilla Readability** + **Turndown** + **Defuddle** (`lib/readability.js`, `lib/turndown.js`, `lib/defuddle.full.js`) | Web page → Markdown |
| Syntax highlighting | **Prism** (`lib/prism.min.js`) | Code blocks |
| Dates | moment (`lib/moment.min.js`) | |
| i18n | i18next (`lib/i18next.min.js`) | |
| Password hash | scrypt (`lib/scrypt.js`) | Account / sync encryption |

Unresolved: `lib/pele.min.js` (699 KB) — purpose not yet identified.

## 4. Security posture (Electron fuses)

4 of 7 security-relevant fuses are in the hardened state:

- ✅ **RunAsNode** disabled — cannot be turned into a Node runner
- ✅ **EnableNodeCliInspectArguments** disabled — `--inspect` ignored
- ✅ **EnableNodeOptionsEnvironmentVariable** disabled — `NODE_OPTIONS` ignored
- ✅ **EnableCookieEncryption** enabled
- ⚠️ **EnableEmbeddedAsarIntegrityValidation** disabled — asar edits not detected
- ⚠️ **OnlyLoadAppFromAsar** disabled — an `app/` folder or `default_app.asar`
  could be loaded instead
- ⚠️ **GrantFileProtocolExtraPrivileges** enabled — `file://` pages get extra
  privileges

## 5. Mapping onto Loom IDE (Tauri)

Today Loom IDE's "Code" mode is a plain `<textarea>`
(`src/main.ts` `initCodeEditor`/`saveNote`/`openNote`) with two hardcoded
documents persisted in `localStorage` (`NOTE_DOCS`). There is no markdown
rendering, no folder-backed vault, no search index, no graph, no links.

Obsidian's architecture translates almost one-to-one onto Loom's existing
Tauri pattern (Rust commands + a plain-TS web frontend — which Loom already
uses for `work.json` via `src-tauri/src/store.rs`):

| Obsidian | Loom IDE equivalent |
|---|---|
| Vault = a folder of `.md` files read/written by the main process | A `VaultStore` in Rust + Tauri commands: `list_vault_files`, `read_note`, `write_note`, `rename_note`, `delete_note` (mirrors the existing `WorkStore`/`work.json`) |
| Renderer `app.js` doing everything in-browser | The existing `src/main.ts` web frontend |
| Synchronous `sendSync` IPC (48 channels) | Tauri commands (async, capability-gated — already the pattern) |
| localStorage + IndexedDB for settings/cache | Keep `localStorage` for UI prefs; a Rust-side vault on disk for notes |
| `worker.js` search indexer | A web worker that builds an in-memory inverted index over note contents (no need for IndexedDB initially) |
| CodeMirror editor | Adopt CodeMirror (or keep `<textarea>` + a markdown renderer) |
| MathJax / PDF.js / Prism | Add only as needed (KaTeX, pdf.js, Prism/Shiki) |
| PixiJS graph view | PixiJS, or a simpler D3/Canvas force layout over `[[wikilinks]]` |
| Wikilinks / backlinks | Parse `[[…]]` in the editor, resolve against the vault file list, render a backlink panel |

### Suggested build order (smallest useful increment first)

1. **Vault in Rust** — `list_vault_files` + `read_note` + `write_note` over a
   chosen workspace directory; replace the hardcoded `NOTE_DOCS` with the real
   tree. This is the single biggest parity gap.
2. **Markdown render** — render notes with a small markdown engine + sanitize
   (DOMPurify); keep editing in the textarea or upgrade to CodeMirror.
3. **Links + backlinks** — `[[wikilink]]` parsing and a backlink list (cheap,
   high Obsidian-feel payoff).
4. **Search** — a web worker index over note contents.
5. **Graph view** — PixiJS/D3 link graph as a later, optional mode.

### Design cautions

- Obsidian is a **closed 3.37 MB bundle**; do not copy its code. Reuse the
  same *open-source libraries* it ships (CodeMirror, KaTeX, pdf.js, Prism,
  readability/turndown) — those are the honest building blocks, and most are
  MIT/Apache/OFL licensed.
- Obsidian couples the editor, renderer and plugins tightly in one bundle;
  Loom's stated "no framework, hand-written DOM" approach can stay, but a
  real editor is hard to hand-roll — CodeMirror is the pragmatic exception.
- The `obsidian-cli` binary + `register-cli` IPC are a separate surface; if
  Loom ever wants a CLI companion, that is the pattern to copy (thin main
  process, URI/IPC bridge).

## 6. Evidence and limits

- Static only; Obsidian was never launched. Fuses and file listings are
  `observed`; the app map and feature mappings are `derived` from the
  minified bundle.
- The 3.37 MB `app.js` was summarized, not fully traced: 11,238 graph nodes
  were dropped at the analyzer's node cap, and 3 IPC channel names are
  computed at runtime. Exact `webPreferences` values are unreadable statically.
- `lib/pele.min.js` purpose, the 3 dynamic IPC channels, and the main-window
  `webPreferences` remain open unknowns.
