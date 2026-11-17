# Issue 002 — Skills surface (add / classify / bulk import) is disconnected

- **Title:** Skills surface (add / classify / bulk import) is disconnected
- **Severity:** P0 — fundamental integration failure of a shipped surface

## Problem statement

The Knowledge › Skills shelf offers Add skill, Classify, and Bulk import
forms. All three call SkillsImportService endpoints that the running Loom
server never registered over HTTP; every action returns HTTP 404
`{"code":5,"message":"Not Found"}`.

## Evidence and file references

- Live probes (2026-11-15, `evidence/live-verification.md`):
  `POST /v1/skills`, `POST /v1/skills/{name}:classify`,
  `POST /v1/skills:bulkImport` → **404 `{"code":5,"message":"Not Found"}`**.
- Same gateway-registration evidence as issue 001:
  `pkg/server/http.go:113` (LoomService only),
  `docs/reference/http-server.md:42,51`.
- The IDE premise is recorded in `docs/DESIGN_PROGRESS.md` ("Skills
  (HTTP): add/classify/bulk-import shelf") and `docs/DECISIONS.md`
  ("Tasks and skills are NOT in this decision — both are 100% HTTP").
- IDE call sites: `src/knowledge.ts:275-328` (renderSkills),
  `src/api.ts:1361-1366`, `src-tauri/src/loom_http.rs:589-648`.

## Root cause

**Confirmed** — identical to issue 001: proto annotations were treated as
a runtime guarantee. `skills_import.proto` declares 3 HTTP annotations but
the gateway registers no SkillsImportService handler.

## Expected behavior

Add/classify/bulk-import round-trip against the server; the shelf reports
the server's actual responses (the "no list endpoint" copy is already
honest).

## Current behavior

Every skill action fails with "Loom returned HTTP 404: Not Found"
(streamed import reports "Skill import failed: …").

## Proposed correction

1. **IDE-side truth (immediate):** probe `POST /v1/skills` availability
   (or reuse a documented decision flag); when unavailable, render the
   shelf with the forms disabled and the gRPC-only explanation.
2. **Loom-side enablement (decision required):** register
   `SkillsImportServiceHandlerFromEndpoint` in `pkg/server/http.go`.

## Affected components

- `src/knowledge.ts` (skills shelf), `src/api.ts`, `src-tauri/src/loom_http.rs`
- Loom: `pkg/server/http.go` (if registration is approved)

## Relevant Loom contracts

- `proto/loom/v1/skills_import.proto` — AddSkill, ClassifySkill,
  BulkImportSkills (annotated, unregistered).

## Acceptance criteria

1. With a registered server: adding one SKILL.md and classifying it
   succeeds and is visible in the server's skill index; bulk import
   streams progress events the shelf displays.
2. With the current server: the shelf states the limitation and no
   control 404s.
3. DECISIONS.md corrected.

## Verification strategy

- Live round-trip after registration (or gating behavior against the
  current server); unit test for the gating state.

## Dependencies

- Shared Phase-5 transport decision with issue 001.

## Regression risks

- Low (frontend gating) / gateway surface change on the Loom side — rerun
  Loom gateway tests.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (server-side, Loom `8082078`). SkillsImportService is HTTP-registered; live `/v1/skills:bulkImport` now returns 400 validation instead of 404. The Skills shelf has a real data source.
