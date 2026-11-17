# Issue 001 — Loom task boards (kanban) are disconnected from the server

- **Title:** Loom task boards (kanban) are disconnected from the server
- **Severity:** P0 — fundamental integration failure of a shipped surface

## Problem statement

The Work view's "Loom task boards" section (boards list, kanban lanes,
task claim/close/release/delete) calls HTTP endpoints that the running
Loom server never registered. Every request returns HTTP 404
`{"code":5,"message":"Not Found"}`. The surface renders as a functioning
planning tool but cannot read or mutate any server state.

## Evidence and file references

- Live probes (2026-11-15, `evidence/live-verification.md`):
  `GET /v1/boards`, `POST /v1/boards`, `GET /v1/tasks`,
  `GET /v1/boards/{id}/ready`, `/blocked`, `POST /v1/tasks:decompose`,
  `GET /v1/agents/{id}/task-context` → **404 `{"code":5,"message":"Not Found"}`**.
- Loom gateway registers only LoomService:
  `pkg/server/http.go:113` —
  `loomv1.RegisterLoomServiceHandlerFromEndpoint(...)` is the only handler
  registration in the whole tree (grep `Register.*ServiceHandlerFromEndpoint`).
- Loom's own docs: `docs/reference/http-server.md:42` ("Only LoomService
  is registered with the HTTP gateway (other gRPC services like
  ToolRegistryService are gRPC-only)") and `:51` ("`/swagger-ui` also lists
  endpoints for services such as TaskService and SkillsImportService that
  are *not* HTTP-registered and are reachable over gRPC only"). Scrub
  commit `cbc590b` (2026-06-29) predates the IDE work by months.
- The proto does declare 19 HTTP annotations (`proto/loom/v1/task.proto`),
  which is the premise the IDE recorded — `docs/DECISIONS.md` ("Tasks and
  skills are NOT in this decision — both are 100% HTTP"),
  `docs/DESIGN_PROGRESS.md` ("Loom tasks + boards … 100% HTTP").
- IDE call sites: `src/main.ts:2375` (kanban), `:2463` (taskCard actions),
  `src/api.ts:1325-1357`, `src-tauri/src/loom_tasks.rs` (all commands).

## Root cause

**Confirmed.** The capabilities were implemented from the proto's
`google.api.http` annotations without verifying the running gateway's
registration list. The annotations are code-generation input, not a
runtime guarantee; TaskService is reachable only over gRPC on every
shipped server.

## Expected behavior

The kanban lists real Loom boards and tasks; create/claim/close/release/
delete round-trip against the server; failures show the server's message.

## Current behavior

"Boards unavailable: Loom returned HTTP 404: Not Found" banner; the New
board/New task/Claim/Close/Delete controls always fail.

## Proposed correction

Two-part, smallest-first:

1. **IDE-side truth (immediate):** gate the section on a live probe
   (`GET /v1/boards`). On 404, render "Loom tasks are gRPC-only on this
   server — the transport decision is open (docs/DECISIONS.md)" and
   disable the controls. Correct the DECISIONS.md/DESIGN_PROGRESS.md
   premise.
2. **Loom-side enablement (decision required):** register the TaskService
   handler in `pkg/server/http.go` exactly as LoomService is registered
   (`loomv1.RegisterTaskServiceHandlerFromEndpoint`). This is a Loom-side
   change; the audit provides the evidence package for Eduardo's decision.

## Affected components

- `src/main.ts` (kanban + dialogs), `src/api.ts` (task bridges),
  `src-tauri/src/loom_tasks.rs`
- Loom: `pkg/server/http.go` (if the registration route is chosen)

## Relevant Loom contracts

- `proto/loom/v1/task.proto` — TaskService (CreateTask … StreamTaskUpdates),
  HTTP annotations present, not registered.
- `docs/reference/http-server.md:42,51`.

## Acceptance criteria

1. A live probe determines the surface's availability without user action.
2. With a registered server: one board + one task created, listed, claimed,
   closed via the UI, and observed in the server's task store.
3. With an unregistered server: the section explains the gRPC-only state
   and offers no controls that 404.
4. DECISIONS.md states the verified transport truth.

## Verification strategy

- Unit: probe-gating logic (mock 404 vs 200).
- Live: full CRUD round-trip once registration lands (or the gating
  behavior against the current server).
- Regression: the kanban must never again render action controls on a 404.

## Dependencies

- Eduardo's Phase-5 transport decision (issue shared with 002); Loom-side
  gateway registration if approved.

## Regression risks

- Low for the gating change (pure frontend). For the Loom-side
  registration: adding a second gateway handler changes the HTTP surface;
  confirm no path collisions and rerun Loom's gateway tests.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (server-side, Loom `8082078`). TaskService is now HTTP-registered (pkg/server/http.go). Live probes (rounds 2–3, doc 13): `/v1/tasks` 200 (15 tasks), `/v1/boards` 200 (5 boards), `/v1/boards/{id}/ready-front` 200. IDE reads boards over HTTP (loom_tasks.rs); the 404 copy names the missing registration (`1c6efb8`).
