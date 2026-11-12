# Obsidian launcher look-and-feel (for the Loom front end)

Analyzed 2026-11-11. Goal: concrete tokens and layout facts from Obsidian's
own launcher so `loom-frontend` (Rust + egui) can match its feel.

## What was analyzed

- App: Obsidian 1.15.0 from snap (`/snap/obsidian/72`), Electron + two asar
  bundles in `/snap/obsidian/current/app/resources/`.
- `app.asar` (73 KB): bootstrap + updater. Loads `obsidian.asar/main.js`
  (`loadApp`, `app/main.js:300`). REA Evidence `ev_5054704b…` (15 JS files,
  1 protocol registration for the `app://` scheme).
- `obsidian.asar` (24 MB): the real app. Electron main is `main.js`
  (212 KB, minified); the launcher page is `starter.html` + `starter.js`
  served as `app://obsidian.md/starter.html`; all styling is `app.css`
  (598 KB).
- Electron fuses (REA Evidence `ev_947db247…`): `--inspect` ignored,
  `ELECTRON_RUN_AS_NODE` disabled. So the screenshots below were taken via
  `--remote-debugging-port` + CDP, not the Inspector.
- Screenshots (this folder, `img/`): `launcher.png` is the first-run state,
  `launcher-vaults.png` is the state with one recent vault (seeded vault).

## Launcher anatomy

Window (from the `Ut` factory + `Se()` in `obsidian/main.js`):

- Starter window is exactly 800x650, **frameless** (`frame: false` unless the
  user picks native frame), `titleBarStyle: "hidden"`, `resizable: false`,
  `maximizable: false`, `backgroundColor: "#1e1e1e"`, no menu bar.
- Window is shown only after the page loads (no white flash).
- The whole window is a drag region except interactive rows
  (`.recent-vaults-list-item` sets `-webkit-app-region: no-drag`).

Layout (from `app.css`, confirmed by screenshots):

- Custom titlebar strip, 24 px (`.starter-screen-inner` is `100% - 24px`),
  with right-aligned min/max/close only. No title text.
- Empty state: single centered column, max width **540 px**:
  logo mark, "Obsidian" title, "Version x" muted line, one full-width accent
  CTA ("Quick start"), then option rows, then a language dropdown.
- With vaults: **280 px left sidebar** (`.recent-vaults`, secondary
  background, 1 px right border) listing vault name (normal) + path (muted)
  + a `...` row menu; the right pane keeps the same centered 540 px card.
- Option rows: title (15 px, normal) + description (13 px, muted) on the
  left, one button right-aligned, 1 px hairline separators between rows.
- No visible card border: the card reads as a panel via a slightly lighter
  fill on the near-black page, plus 12 px rounding.

## Design tokens (dark theme, exact from `app.css`)

Base ramp (`.theme-dark`):

| Token | Value |
|---|---|
| `--color-base-00` (page bg) | `#1C1C1C` |
| `--color-base-10` (alt bg) | `#232323` |
| `--color-base-20` (sidebar bg) | `#282828` |
| `--color-base-25` (form field bg) | `#2E2E2E` |
| `--color-base-30` (borders, buttons) | `#333333` |
| `--color-base-35` (hover) | `#3F3F3F` |
| `--color-base-50` (faint text) | `#666666` |
| `--color-base-70` (muted text) | `#B3B3B3` |
| `--color-base-100` (normal text) | `#DADADA` |

Accent is HSL-based: `--accent-h: 258, --accent-s: 88%, --accent-l: 66%`:

| Token | Computed |
|---|---|
| accent (CTA fill) | `#8A5CF5` |
| accent-1 (hover) | `#A68AF9` |
| accent-2 | `#C5B6FC` |
| text on accent | white |

Semantic: red `#FB464C`, orange `#E9973F`, yellow `#E0DE71`,
green `#44CF6E`, cyan `#53DFDD`, blue `#027AFF`, purple `#A882FF`,
pink `#FA99CD`.

Type:

- UI family is the system sans stack with Inter first
  (`--font-default: ..., "Inter Variable", "Inter", ...`); Inter's woff2
  ships in the bundle (`public/InterVariable*.woff2`). Mono is Source Code
  Pro (`public/SourceCodePro-*.ttf`).
- UI sizes: 12 / 13 / **15** / 20 px (`--font-ui-smaller/small/medium/large`).
  Launcher titles are 15 px medium; descriptions 13 px muted; sidebar rows
  13 px. Line height 1.5.
- Weights: normal 400, medium 500 for row titles, semibold 600.

Shape and spacing:

- Radii: 4 / 8 / 12 / 24 px (`--radius-s/m/l/xl`); inputs and buttons 5 px;
  launcher card 12 px; list rows 4 px.
- Spacing is a 4 px scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 …
- Borders: 1 px, `--color-base-30` (`#333333`).
- Sidebar row padding: 8 px top/bottom, 12 px left, 24 px right; 4 px gap
  between rows.
- Inputs are 30 px tall with layered inner + drop shadows (see
  `--input-shadow`); no focus ring by default, 2 px accent outline on focus.
- Selection: 33% accent wash, no border.

## Component recipes

- Primary CTA: accent fill, white 15 px medium text, 5 px radius, full-width
  in the empty state, fixed-width (~110 px) when row-aligned. Hover shifts to
  accent-1. No border, no shadow.
- Secondary buttons ("Open", "Sign in"): `#333333` fill, `#DADADA` text,
  5 px radius, ~110x30 px. Hover `#3F3F3F`.
- Text rows: title + muted description, hairline `#333333` separators, no
  row background until hover (6.7% white wash).
- Dropdown (language): form-field fill `#2E2E2E`, 5 px radius, 30 px tall,
  chevron right, leading `...` help icon outside the field.
- Sidebar items: transparent until hover, 4 px radius, name + muted path
  stacked, `...` button appears at the row's right edge.
- Titlebar controls: 3 dark icon buttons, no background, top-right.

## Mapping to `loom-frontend` (egui)

Biggest gaps in `src/main.rs` today: stock egui visuals (light/dark follows
OS, blue `#2563EB` accent, Noto Sans) and a page-per-tab structure with no
unifying shell. To feel like Obsidian:

1. Force the dark palette above in `setup_theme` (`Visuals::dark` + exact
   `window_fill #1C1C1C`, `panel_fill #282828` for a left rail,
   `faint_bg #232323`, `extreme_bg #2E2E2E`, hyperlink/selection accent
   `#8A5CF5`). Stop following the OS theme for this shell.
2. Type: Inter UI + Source Code Pro mono (same files Obsidian ships; both
   are OFL-licensed), sizes 12 / 13 / 15 / 20 px, row titles medium.
3. Shell: frameless-feeling window is optional in egui, but copy the layout
   grammar — 280 px muted left rail with stacked name+detail rows,
   centered max-540 px content card with 12 px rounding, 24 px-tall
   drag/title strip with window controls right.
4. Rows everywhere: title (15 px) + muted description (13 px) + one
   right-aligned action; 1 px `#333333` separators; 4 px row radius.
5. Buttons: primary = accent fill + white text, 5 px radius; secondary =
   `#333333` fill. No egui default button bevel (set `button_frame` fill
   accordingly and remove the stroke).
6. Inputs 30 px tall on `#2E2E2E` with 5 px radius; focus = 2 px accent
   outline, not egui's default stroke.

## Evidence and limits

- Static: REA MCP `analyze_javascript_application` on `app.asar` (summary
  retained) + REA CLI 6.8.0 on extracted `app/` and on `obsidian/main.js`
  (`--source-path main.js`, Evidence saved under `/tmp/obsidian-rea/`).
  The REA MCP server dropped mid-session (whole-`obsidian.asar` call timed
  out, then `MCP stdio connection is closed` twice); the CLI fallback
  covered the same ground. Restart the MCP client if REA tools stay down.
- On minified `obsidian/main.js` REA reports 0 BrowserWindows (aliased
  `r.BrowserWindow` defeats static identity); the window facts above come
  from direct inspection of the `Ut` factory and were corroborated by the
  800x650 screenshots, which is the stronger evidence for look-and-feel.
- Screenshots were taken headless (Xvfb + CDP `Page.captureScreenshot`),
  fresh profile, `--disable-gpu`. Colors are exact page renders.
- Extracted sources used: `/tmp/obsidian-rea/app/main.js`,
  `/tmp/obsidian-rea/obsidian/{starter.html,starter.js,main.js,app.css}`.
  Re-extract with `node asar-extract.js <file.asar> <outdir>` (script kept at
  `/tmp/muse-shell-sandbox-c82c773f-7aaf-4666-9e2b-67e7834b4459/asar-extract.js`)
  if `/tmp` is ever cleaned.
