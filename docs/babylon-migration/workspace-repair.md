# Spatial workspace repair — 17 November 2026

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
