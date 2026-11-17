# 09 — Software Engineering Assessment

## TypeScript (vanilla, no React — correctly)

| Aspect | Finding |
|---|---|
| Type safety | Strong — `Intent`/`ChatReply`/`Session`/`McpServer` etc. typed; `IntentAutonomy` is a union of the four levels |
| Module boundaries | `api.ts` (all `invoke` wrappers), `main.ts` (UI), `knowledge.ts`, `spatial.ts`; one module per concern |
| State management | Explicit module `let` state + a minimal DOM diff/render pattern; no framework, no store library — appropriate for the size |
| Event handling | Stream events via a single `handleStreamEvent` dispatcher with typed `LoomStreamEvent` |
| Async | `async`/`await` with capture-before-`await` discipline; settle-once guards for overlapping sends |
| Error handling | Typed error paths (rejection vs disconnection); partial-reply preservation |
| Testability | Real handlers are extracted from `main.ts` source (`?raw` + `transformWithOxc`) and driven with a fake DOM + mocked Tauri bridges — this is what makes the 97-test suite possible without a headless browser |

## Rust / Tauri

| Aspect | Finding |
|---|---|
| Command boundaries | ~141 `#[tauri::command]`s; mostly thin gateway calls or local CRUD; clean separation |
| Serialization | Explicit dual-casing at the boundary (camelCase protojson vs snake_case SSE), pinned by negative tests |
| Error propagation | `Result<_, String>` throughout; stream errors carry the server message |
| State ownership | `AppState` (Mutex-wrapped stores) + `AppHandle`; per-request `AtomicBool` cancellation |
| Concurrency | Stream threads with cancel flags; `spawn_blocking` for network I/O |
| Resource cleanup | Deadline-capped readers; bounded buffers; temp-file atomic writes |
| Filesystem security | Symlink rejection, external-edit refusal, `LOOM_VAULT_DIR` override |
| Contract drift | The two wire formats are the main risk; now mitigated by 28 fixtures |

## Unity (WebGL bench, bridge over `postMessage`)

| Aspect | Finding |
|---|---|
| Lifecycle | `Awake` builds the bench at runtime (no baked GI); `ApplyTheme`/`ApplyLoomState`/`ApplyBackground`/`ApplyQuality`/`ApplyCanvasSize` set from Tauri |
| Rendering | DPR cap 2, reduced-motion freezes geometry, quality tiers (High/Balanced/Low) |
| JS interop | `window.parent.postMessage` guarded by origin check; error events relayed |
| Isolation | WebGL player cannot read the vault from disk (documented); scene state driven by messages |
| Verification | Recompile + CheckWorkbench (Play-mode self-check) exist but are environment-blocked this audit |

## Repository quality

| Aspect | Finding |
|---|---|
| Build reproducibility | `npm run build` deterministic; `cargo --offline --locked` tests green |
| Dependency hygiene | Minimal: Monaco (one UI dep), no new deps added without decision; no React |
| Test coverage | 97 + 132 + 22 green; transport/contract layer well covered |
| Documentation | Extensive (DESIGN_PROGRESS, DECISIONS, FOLD_REPORT, audit corpus) |
| Technical debt | **native-app is not rustfmt-clean** (pre-existing since `41170a6`; documented as out of the fmt gate); dead `Sphere` class noted in DECISIONS; retired query-composition stub already removed |
| Duplicated code | The SSE/NDJSON reader is shared (one consumer for all seven streams) — no duplication |
| Dead abstractions | Minimal; the retired stub was dropped; `find`ing/`decision` kinds are reserved-but-unproduced (honest) |

## Engineering verdict

The stack is **appropriate and well-executed** for a thin human-centered
client: vanilla TS keeps the UI inspectable, Tauri/Rust keeps the boundary
typed and fast, Unity WebGL provides the one spatial surface. No rewrite is
warranted. The concrete engineering debt is small and enumerated: native-app
formatting, the reserved-but-unproduced attention `finding` kind, and the
absence of a held-out eval set (see `08`).
