# QC-07 — Approval cards answer the wrong Loom request store

Severity: **P1**. Confidence: **Strongly supported: separate stores and wrong route confirmed; live pending approvals were not modified.**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Status (2026-11-16)

**FIXED (routing), round-trip unverified.** The IDE routes approval cards
through `respond_human_request` → `POST /v1/human-requests/{id}:respond`
(`ff272af`, `de3b4fc`), matching the shared `HumanRequestStore` Loom
exposes over HTTP since `8082078` (status vocabulary
`approved`/`rejected`/`responded`; parked turns refused with 409 —
source-confirmed). Live **route** probes passed: bogus-id + invalid
status → 400 (validates before lookup); bogus-id + `approved` → 404
(store wired); GET → 405 (doc 13 §3). **Not executed:** a successful
held-request round-trip — an actual parked tool, approved through this
endpoint, observed to run — requires a live held tool and is tracked in
`15-execution-plan.md` W-5. Question cards keep using the legacy
clarification endpoint, which is the correct split (doc 13 Phase 3).

## Problem and current behavior

Every HITL card sends request_id through AnswerClarificationQuestion. Hook-held and parked approval IDs belong to HumanRequestStore, while that RPC only searches the legacy pendingQuestions map.

## Evidence

- [src/main.ts:5104](/home/ed/loom-ide-tauri/src/main.ts:5104) (`function renderHitlCard(`)
- [loom/pkg/server/multi_agent.go:3873](/home/ed/work/loom/pkg/server/multi_agent.go:3873) (`question, exists := s.pendingQuestions[req.QuestionId]`)
- [loom/pkg/shuttle/human_store_sqlite.go:459](/home/ed/work/loom/pkg/shuttle/human_store_sqlite.go:459) (`func (s *SQLiteHumanRequestStore) RespondToRequest(`)

## Root cause

The IDE conflates legacy questions with stored requests. The existing store resolves approved/rejected/responded statuses; an HTTP answer adapter for that store was not found in the inspected LoomService.

## Expected behavior

Approve/Deny must resolve the exact server-held request and show its tools, arguments, reasons and expiry before continuing. Legacy questions retain their own question_id path.

## Proposed correction

Classify the producer/request type and expose the existing store operation through the approved transport. Send its actual status vocabulary and identities. Until that exists, label these cards unanswerable here and provide honest recovery; do not pretend clarification routing grants approval.

## Affected components

Chat approval cards; Loom held-request store and API adapter.

## Relevant Loom contracts

HITLRequestInfo.request_id/question_id/kind/context_json; HumanRequestStore.RespondToRequest. Runtime support exists; an IDE-accessible answer transport is missing.

## Acceptance criteria

- A held counted tool cannot execute before approval.
- Approve executes it once; Deny never executes it.
- Expired and mixed parked batches show the real store state; per-item reasons remain inspectable.

## Verification strategy

Use Loom parked-card and HumanRequestStore test patterns in an isolated backend, then UI approve/deny/expire/restart workflows.

## Dependencies

Loom-side transport exposure and QC-06. Do not modify Loom during this audit.

## Regression risks

Never map arbitrary text approve/deny to a generic permission grant. Preserve server-owned expiry and exactly-once decisions.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED + LIVE-VERIFIED. Loom `8082078` adds `POST /v1/human-requests/{id}:respond` over the shared HumanRequestStore; IDE approval cards route there (`de3b4fc`), question cards use the legacy clarification map; live route probes passed (doc 13 §3).
