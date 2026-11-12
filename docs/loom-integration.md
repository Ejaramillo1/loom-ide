# Loom integration boundary

Verified against the Loom protos and HTTP layer (audit 2026-11-11,
against `Ed-Jaramillo/loom` main): `proto/loom/v1/loom.proto` declares
`POST /v1/weave` (JSON `query`, optional `agent_id` and `session_id`,
response `text`, `session_id`, `trace_id`), `GET /v1/agents`,
`GET /v1/sessions` + history, `GET /v1/workflows` +
`POST /v1/workflows:execute` (+ `:stream` variant, unused),
`GET /v1/workflows/executions`, `GET /v1/artifacts` (optional
`?session_id=` filter), and `GET /v1/health`. `pkg/server/http.go`
declares `GET /health` — a static stub returning 200
`{"status":"healthy"}` unconditionally — so the status probe uses
`GET /v1/health`, which pings each configured LLM provider and reports
`healthy` / `degraded` / `unhealthy` per component.

Contract notes that shape the client:

- The gateway (grpc-gateway / protojson) encodes every 64-bit integer
  as a JSON string (`"uptimeSeconds": "3600"`). The backend parses
  `i64` fields tolerantly (number or string).
- The server ignores `limit`/`offset` on session history and 404s for
  sessions not in memory (e.g. after a restart).
- Workflow executions carry no session/work id or workflow name, so
  per-work attribution is impossible from the API; the list is global.
  `WorkflowExecution.result` is the run's actual output.
- Artifacts carry a `session_id` and support `?session_id=` filtering;
  the unfiltered list silently caps at 50 rows by default.
- There is no experiment/hypothesis interface in the HTTP API;
  `POST /v1/providers:abtest` is LLM-provider A/B testing only. There
  is no findings/evidence API (only HITL `ResolveExecutionGap`), and
  `GetTrace` is unimplemented server-side, so no trace view is possible.

What is wired in this prototype: session continuity (work↔session
binding + per-work chat cache), real agents/sessions/workflows/
artifacts/executions, and attention items fed by local experiment
decisions waiting on the human. Not wired: streaming (`:stream`
variants, `GET /v1/sessions/{id}:subscribe`), workflow scheduling,
model switching, and collaboration steps (the server exposes no
execution-step API). Failed live requests produce an error instead of
a fabricated response.

The Tauri adapter targets an unauthenticated loopback HTTP service at
port 5006. The old browser bridge (`app/loom-backend.mjs`, with
`LOOM_URL` / `LOOM_AGENT_ID` / `LOOM_API_TOKEN`) is orphaned — nothing
references it; `vite.config.ts` uses a plain `/api/loom` proxy instead.
