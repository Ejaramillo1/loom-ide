# Spatial workspace repair — 17 November 2026

Historical entries below record each shipped step. The last follow-up defines
the current navigation, Intent placement and renderer verification gates.

Baseline: `bf95854`. The screenshot at 18:32 showed a renderer pilot in a
broken two-region shell. This repair implements the user's requested workspace
around the sphere; it does not declare the entire Unity retirement complete.

## Review findings addressed

| Finding | Result |
|---|---|
| Work hidden in Spatial | Existing Work list is visible above the original chat, with an Open Work action. Intent/autonomy uses a disclosure instead of a clipped form. |
| Chat and context mutually exclusive | The same chat node moves to the left slot in Spatial and back to the inspector in other modes. Both chat and context remain visible in Spatial. |
| Missing collaboration | Compact summary renders server agent name, status, active-session count and error, with real detail navigation. Loading/offline/empty/failure are distinct. |
| Browser could never load agents | Added read-only browser gateway list/detail paths, with protojson field validation and contract tests. No agent execution was added. |
| Missing orbital controls/navigation | Six keyboard-accessible HTML shortcuts use the existing router. Evidence opens the actual Knowledge Evidence view. Bottom mode navigation stays reachable. |
| Framed scene/background seam | Removed the framed reading surface. Transparent player and matching iframe color scheme let the shared atmosphere continue through theme changes. |
| Striped sphere/harsh reflection | Replaced painted texture/material with a procedural pearl shader, restrained state rim and flowing contours. Shadow/reflection use fading ellipses sized to the sphere. |
| Unbalanced/clipped layout | Three regions at desktop widths; sticky chat plus scrollable context at tablet widths; one scrollable stack on mobile. Composer and navigation have browser assertions. |
| Header crowding | Application menus are consolidated into a keyboard-accessible native disclosure. Dynamic work title and connection status retain their existing sources. |
| Draft loss during startup | Restore drafts/register chat handlers and stream listeners before slow server initialization. Restoration also preserves any newer input. |
| Inadequate verification | Added real production-page smoke checks, screenshots, collaboration rendering tests and draft/layout regressions. |

## Verification and scope

- Frontend: **144 passed (16 files)**.
- Tauri: **145 passed, 2 ignored**. Initial sandbox socket failures were rerun with loopback access; final log is the successful run.
- Preserved native app: **22 passed**, including loopback navigation tests.
- Vite production build and src-tauri fmt: passed.
- Tauri release application build (`CARGO_NET_OFFLINE=true npm run tauri build -- --no-bundle`): passed; no installer packaging or native-window screenshot is claimed.
- Production browser smoke: `scripts/workspace-smoke.mjs`, with Chromium CDP and no added dependencies. Final evidence in `evidence/workspace/browser-results.json` and matching screenshots/log.
- Viewports: 1366×650 (browser-content equivalent of the reported screenshot), 1671×941 light reference, 900×720 tablet, 390×740 mobile.
- The browser test uses an isolated incognito context, blocks Loom HTTP requests, creates a temporary local Work through the real UI after screenshots, and disposes the entire context. No personal records or live model turns are used. Offline screenshots are deliberately honest empty states, not populated demo views.
- Browser checks cover simultaneous panels, no horizontal overflow, reachable composer/navigation, chat node/draft preservation, all orbital routes, dynamic Work/chat header, quality resolution change, context-loss error and retry. They capture JavaScript exceptions and console errors; Chromium software-GPU ReadPixels performance diagnostics are not represented as zero system diagnostics.
- The old Unity recompile command was attempted under the standing checks and returned `EDITOR_NOT_RUNNING` (exit 12). It is historical-source tooling, not verification of Babylon; this repair does not start Unity.

## Decisions taken

1. Reuse the single real chat and inspector; reparent the chat instead of duplicating handlers or drafts.
2. Use HTML controls around the sphere. The old six-mesh Unity diorama is not restored.
3. Preserve access to intent/autonomy while keeping it collapsed until requested.
4. Show actual agent fields only; no invented steps, percentages, task counts or pause controls.
5. Keep navigation/composer reachable through stacking/scrolling on narrow screens, without Spatial modal drawers.
6. Keep the engine inside the existing iframe and preserve historical Unity files. No dependencies or Loom changes.

## Limits

Browser screenshots establish the repaired shell and renderer in Chromium, not
pixel identity with the concept image. Actual Tauri-window pixels, hardware GPU
cost, and live held-tool/model interaction were not exercised. Existing gateway
and runtime policy work remains in the separate Loom project. Repository cleanup
and final deletion of historical Unity assets are outside this UI repair.

## Follow-up: modes belong to the sphere — 17 November 2026

At the user's request, the separate bottom bar and old shortcut copy were
consolidated into one navigation element with exactly Overview, Code, Experiment,
Work, Agents and Knowledge. In Spatial it is positioned around the sphere. In
other modes the same element moves above the workspace, preserving a way back
to Overview. Evidence remains available inside Knowledge. No duplicate menu or
second set of handlers was added. The shell now has only header/main rows.

Updated tests assert both navigation placements and all six labels. Production
browser evidence was refreshed for desktop, light theme, tablet and mobile.
Required checks: frontend 144; Tauri 145 passed / 2 ignored; native 22; build and
src-tauri fmt passed. Legacy Unity recompile remains blocked with exit 12 because
the Editor is not running; this is not the active renderer.

## Follow-up: keep orbital controls, sphere home and Work intent

This supersedes the six-mode menu described above. The user's clarification
keeps **Work, Experiments, Evidence, Agents, Knowledge and Code** around the
sphere and removes the separate floating menu. The main sphere supports pointer
picking and Enter/Space activation for Overview. A small persistent header
sphere provides the same return path from views where the main sphere is hidden.
The routes still use the existing router; Evidence opens its Knowledge tab.
Intent & Autonomy is now inside the Work panel, using the same editor and
handlers. Expanding it gives Work more space without overlapping chat. The
closed Work list retains at least one usable row at all four checked sizes.

### Renderer and verification changes

- State tint now blends pigment into the pearl surface/rim. Derivative filtering
  reduces subpixel contour aliasing at Low quality. State captions remain.
- Readiness waits for actual material compilation. A compile failure reaches the
  host error/retry UI instead of reporting ready with an invisible sphere.
- The stream/navigation regression exercises the real production chat handlers
  and router together with a minimal DOM. It preserves token accumulation,
  request identity, tool rows, draft and scroll across Code/Overview navigation,
  then asserts one settlement even when a terminal event repeats. It is a
  deterministic event test, not a live model call.
- `npm run test:spatial` builds current source, launches an ephemeral Vite preview
  and its own Chromium profile/incognito context, and disposes its processes.
  No prestarted browser, debug port or preview is required. Installed Chromium
  is required; `CHROMIUM_BIN` can select it. No new dependency was added.
- The browser test asserts restored orbital labels/bounds/routes, sphere picking
  and keyboard activation, Work/intent containment, expanded layout, composer
  reachability, draft identity, quality resolution and context-loss recovery at
  1366×650, 1671×941, 900×720 and 390×740.
- The visual check freezes motion and captures all eight states in both themes
  at High and Low quality (32 screenshots). It waits for delivered state messages
  and rendered frames, measures the actual pixels, requires every state pair's
  rim means to differ by at least 8 average RGB units, checks red/green/blue/amber
  meanings, clipping, local pixel contrast and High/Low hue consistency. These
  are measured assertions rather than a screenshot-hash guarantee across GPUs.
- A separate injection corrupts the real GLSL at compilation: error must appear,
  readiness must stay withheld, and a normal retry must recover. Expected compiler
  errors are recorded separately from unexpected exceptions.

### Current decisions and limits

`decisions.md` §§5 and 10 now explicitly preserve the existing CSS atmosphere
preferences and define sphere diameter as 60% of the smaller iframe dimension
(about 25–29% of full desktop width here). Those choices are implemented but do
not claim exact reference-image proportions. The iframe document uses
`color-scheme: normal` only to preserve transparency; host forms retain their
selected theme.

The repository judge and AGENTS now gate on Babylon instead of Unity recompile
or CheckWorkbench. Run `bash judge/run-judge.sh --verify-only`; it dispatches no
coding agent, records each gate, and returns a nonzero exit if any gate fails.
Its outputs stay in this repository's `judge/runs` and `judge/verdicts`.
The separate `/home/ed/judge` copy was not edited under the repository boundary.

Native Tauri-window pixels, real GPU performance and a live Loom/model stream
were not exercised. Standalone state captures have a transparent canvas over
the browser's page background; full-shell dark/light captures separately show
the actual atmosphere. Historical Unity files remain preserved.

### Attention visibility follow-up

Attention starts hidden and appears only when its current item list is nonempty.
Clearing the final item removes the panel and its layout space again; existing
count/badge and decision-dialog behavior remains. A production-renderer unit
regression covers empty → decision → empty and the decision action. The offline
browser smoke asserts the panel has zero height at every checked viewport.

### Final verification of this follow-up

The working tree based on `99a1280` was checked with
`bash judge/run-judge.sh --verify-only`. All six gates passed (exit 0):

| Gate | Result |
|---|---|
| Frontend | 147 passed, 17 files |
| Production build | Passed |
| Tauri lib | 145 passed, 2 ignored |
| Native app | 22 passed |
| rustfmt | Passed, src-tauri manifest scope |
| Babylon smoke | Four shell viewports, 32 state captures, shader failure/retry passed; zero unexpected exceptions |

The final runner verdict is `judge/verdicts/20261117-194310.md` from the
repository root; the full capture is `judge/runs/20261117-194310.log`. Earlier successful passes
are preserved separately. The smoke's compiled-state error injection is expected
and counted in `evidence/workspace/shader-failure.json`; it is not hidden in the
unexpected-exception total.

### Local change record

UI/source commit: `12b5759` (the verified source changes from the tree above).
Files: `index.html`; `src/main.ts`; `src/style.css`; `src/spatial.test.ts`;
`src/spatial/babylon-player.ts`; `src/spatial/bench.ts`; `src/spatial/bridge.ts`;
`src/spatial/pearl.ts`; `src/spatial/state-colors.ts`;
`src/chat-lifecycle.test.ts`; `src/workbench-layout.test.ts`;
`src/attention.test.ts`.

The accompanying verification/documentation commit contains `AGENTS.md`,
`package.json`, `scripts/workspace-smoke.mjs`, `scripts/browser-harness.mjs`,
`scripts/sphere-visual-check.mjs`, `judge/run-judge.sh`,
`judge/JUDGE_PROMPT_TEMPLATE.md`, the three successful verification logs/prompts/
verdicts under `judge/`, this report, `docs/DESIGN_PROGRESS.md`, and migration
`decisions.md`, `inventory.md`, `implementation-repair.md`. Evidence includes
updated workspace screenshots/metrics, 32 state images, pixel measurements and
the shader-failure record. Pre-existing gate logs in the workspace evidence
folder remain historical; the final combined judge log above is current.


## Follow-up: remove the Overview Work section — 17 November 2026

The latest screenshot request supersedes the earlier Work-above-chat layout.
Overview no longer displays the Work heading, counts, catalogue/search,
Open Work link or Intent & Autonomy disclosure. The existing conversation
fills the released column space. Mobile retains its sphere-then-chat stack.
The left region's accessible label now follows its actual conversation role.

The catalogue and intent controls remain usable in Work/Experiment, reachable
through the existing orbital Work shortcut; saved work/intent data is preserved.
The redundant Overview-only Open Work button, handler and layout rules were
removed. The browser smoke now checks that the section has no layout space in
Overview and that Work navigation still exposes the catalogue and intent editor,
including via the narrow-screen drawer. No dependencies or Loom changes.


Verification: `judge/verdicts/20261117-195355.md` records all six gates passing:
147 frontend tests / 17 files; 145 Tauri tests passed / 2 ignored; 22 native
passed; build and src-tauri fmt passed; four browser layouts and 32 state
captures passed, with zero unexpected browser exceptions. The first smoke
attempt (`20261117-195258`) failed because its new alignment assertion assumed
desktop alignment on mobile. The corrected assertion respects the existing
mobile stack; no product-code change was needed for that failure. Both logs
and verdicts are preserved. Native-window pixels and live model turns were
not exercised.

Changed files for this step: `index.html`, `src/main.ts`, `src/style.css`,
`src/workbench-layout.test.ts`, `scripts/workspace-smoke.mjs`, migration
`decisions.md` and this report; refreshed workspace screenshots/metrics and
new judge logs/prompts/verdicts. Decision taken: remove the pictured section
from Overview while preserving Work editing in its existing workspace.
