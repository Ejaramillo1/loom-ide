# Approved reference implementation

Date: 2026-11-14. Repository: `/home/ed/loom-ide-tauri`. Branch: `tauri-prototype`.
Baseline: `fe0c01e`. Implementation is in the existing application, not a mockup.

## Delivered behavior

- Spatial: the original conversation pane sits left of the Unity bench; the right rail stacks Knowledge Graph over Canvas. At widths below 1100px, conversation and Knowledge become mutually exclusive drawers with close controls, scrim, Escape handling, focus trapping and focus return. Other modes retain their existing 1440px inspector breakpoint and remembered tab/open state.
- The conversation's DOM, draft, sessions, agents and submission handlers are reused. No conversation store was added. The Knowledge rail reuses the existing vault listing, graph/canvas renderers, positions, typed edges, note dialog and mutation/draft guards. Open actions lead to the full Knowledge tools. Preview nodes open the same editor. No editor or vault store was duplicated.
- Real vault notes and edges supply both views. Empty vaults and failed loads have explicit states. SVG marker IDs are scoped to each graph. Canvas dragging accounts for the compact scale, shares positions with the full tool, and drops edges whose endpoints no longer exist in a refreshed listing.
- Unity: the six primitive silhouettes are replaced with 148 composed physical mesh parts: open notebook (leaves/rules/bookmark/pencil), laptop (hinge/display/keyboard/trackpad), wooden toolbox (planks/straps/rivets/hammer/screwdriver), glass flask (shaped vessel/lip/etchings), robot (body/face/joints/limbs/antenna), and magnifier over blank documents. No pictured messages, numbers, metrics, graph data or progress were copied.
- Existing URP resources supply materials; runtime geometry and a small generated grain texture add detail without packages or external assets. The sphere, state-color rules, Dark/White synchronization, reduced motion, portal callbacks and counts remain. Child colliders route selection to the original anchor. Hover/selection lift and scale remain; tools keep a stable useful orientation. Camera framing accommodates the narrow center column.

## Verification

| Check | Result |
| --- | --- |
| `npm test -- --run` | 58 passed in 8 files (50 existing + 8 new) |
| `npm run build` | Passed, TypeScript and Vite |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib` | 89 passed, 2 ignored, 0 failed |
| `cargo test --offline --locked --manifest-path native-app/Cargo.toml` | 22 passed, 0 failed |
| `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | Passed; no native-app formatting |
| Unity recompile after final controller edit | Passed, 0 errors, 0 warnings |
| `Tools/CheckWorkbench.cs` in Play Mode | Passed: 6 portals, 148 parts, valid mesh indices/finite vertices, child collider routing, reduced-motion stability, selection scale, both themes, camera bounds at aspect ratios 0.65/1/1.6 |
| HTML structural check | Unique IDs, one chat form/input, one Knowledge dialog/new-note entry, one Unity iframe |
| Final WebGL rebuild (with LoomGlass fix) | Succeeded 16:38; `spatial.wasm` 35,049,618 bytes, `spatial.data` 10,036,572 bytes, framework/loader refreshed 16:38 |
| `npm run tauri build -- --no-bundle` | Passed; release binary refreshed 16:45 (25,317,408 bytes) |
| Generated player in `dist` | Verified 16:40: `spatial.wasm` 35,049,618 bytes, `spatial.data` 10,036,572 bytes, loader/framework/TemplateData present |

The initial sandboxed Rust runs failed the two existing window-registration tests because loopback binding was prohibited. The identical suites passed with authorized host loopback access. Unity's initial Editor launch also required host access and startup time. No build was killed. Early test-harness type/import errors were corrected using Vite's already installed transform API; final frontend checks pass.

Existing warnings remain: Tauri's retained `WORKBENCH` constant; native-app's unused `Exploring` and `Comparison` variants. The two ignored Tauri tests require live Loom and the real vault; neither was enabled.

## Local commits

- `7e6099f` — unified Spatial composition, reused Knowledge renderers and frontend regressions.
- `5d273bf` — physical object forms, retained LoomGlass variant, camera framing, CheckWorkbench self-check.
- `c8aa164` — empty states unified to the audit pattern (D9).

## Boundaries and limitations

- No browser screenshots, desktop pixel inspection or rendered Unity/WebGL appearance review was performed. Prior browser/computer inspection was permission-blocked; no alternative capture route was used to bypass that block. Geometry and bounds checks do not establish visual quality, glass sorting, absence of occlusion, frame rate or photorealistic parity. No such parity is claimed. Glass uses transparent URP Lit shading; it does not simulate optical refraction or magnification.
- Native-app source and backend source are unchanged. No packages, workspace/project/clone, seed/demo records, data migrations or user-vault writes were introduced. No files were intentionally deleted from the source tree. Nothing was pushed, merged, rebased or reset.
- The approved Markdown reference, attached WebP and existing implementation prompt remain preserved and untracked.
- Q2 remains undecided; Unity load-failure handling is unchanged. JSON Canvas export and existing canvas session-only position persistence remain as before. Compact Canvas can be scrolled to reach all notes; graph density still depends on vault size.
- Live server workflows and actual desktop rendering/input were not exercised. The real user vault was not used by unit tests. The built desktop app will be left at `src-tauri/target/release/loom-ide` for the user to run.
