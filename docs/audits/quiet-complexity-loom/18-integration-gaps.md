# 18 — Integration-gap status (partial wirings, 2026-11-18)

> Owner-supplied list of nine "partial, wired with one concrete hole"
> areas, re-verified against the current tree (`f75ad9f` lineage, HEAD at
> this pass) and the running Loom `8082078` loopback server. Each item is
> marked **already wired** (the list was stale), **closed this pass**, or
> **blocked server-side** (Loom exposes no endpoint — named exactly).

## Already wired (list was stale)

| Area | Evidence |
|---|---|
| Schedules pause/resume/cancel | `renderSchedules` has Pause/Resume toggle + "Cancel run" on history rows; wrappers `pauseWorkflowSchedule`/`resumeWorkflowSchedule`/`cancelScheduleExecution` exist (`api.ts`) |
| Workflow templates | `listWorkflowTemplates()` joins the workflow picker, labelled "· template" (`main.ts:2508`) |
| Tools register + request-permission | "Register tool…" (`openRegisterToolDialog`) and the per-tool permission dialog (`openToolPermissionDialog` → `requestToolPermissionCmd`) are wired |
| TLS renew | "Renew certificate" button → `renewCertificate()` (`main.ts`) |

## Closed this pass (IDE-side, feasible)

1. **Cost aggregate report** — a "Costs" dialog over the durable run
   records (per-work totals, uncosted count) plus per-session totals,
   with an explicit scope note (IDE-recorded, not server billing). Loom
   has no cost-summary endpoint, so a remote aggregate is impossible;
   this is the honest local report.
2. **HITL pending-request list** — requests arrive only via the live
   stream (no server list endpoint), so the IDE now records each
   observed request in a persisted ledger and a "Pending requests"
   dialog lists them (kind, summary, session/agent, status). Answering/
   approving from the chat card marks the entry resolved.
3. **Vault sync reconcile (update-only)** — `mirror` now refreshes a
   *pristine* mirror when the server's metadata changed (guarded so a
   human-edited note is never overwritten). Deletes are deliberately
   **not** mirrored: removing a human-visible note because a list was
   transiently empty is destructive and stays an owner-gated decision.

## Blocked server-side (named Loom work)

| Area | Blocker | What Loom would need |
|---|---|---|
| Skills list | `GET /v1/skills` → 501; SkillsImportService has no list RPC | a `ListSkills` RPC + HTTP route (or the IDE reads the skills files, but there is no HTTP surface) |
| Remote trace list | `GET /v1/traces` → 404; only `GET /v1/traces/{id}` exists | a `ListTraces` RPC (the in-memory 1-hour store already exists) |
| Cost endpoint | `GET /v1/cost*` → 404 | a cost-summary RPC (aggregate over sessions/usage) |
| Two-way vault sync | no server contract for writing markdown notes back to Loom | a defined write target (artifacts/sessions) or an explicit "local vault is the store" decision |
| Vault sync deletes | destructive on the IDE side; server list can be transiently empty | an explicit reconciliation contract before any auto-delete |

None of these blocks the IDE's shipped functionality; each is an
honest limitation with a named unblock condition.
