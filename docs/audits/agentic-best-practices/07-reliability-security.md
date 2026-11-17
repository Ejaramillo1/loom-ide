# 07 — Reliability & Security Assessment

## Reliability

| Concern | Finding | Evidence |
|---|---|---|
| Durable execution | Client run records (capped 200, corrupt-byte backup) + Loom session history; exactly one record per settle; crash mid-run leaves *no* invented outcome | `recordRunStart`/`recordRunSettle`, run-records tests |
| State recovery | Vault atomic writes (temp+`sync_all`+rename), pending-journal replay, conflict preflight; corrupt layouts never overwritten | `knowledge.rs` `atomic`/`replay` |
| Idempotency | Failed POST never replayed (may have executed); GET-only retry (one, 500 ms, refused/timeout only) | `loom_request_with_headers` |
| Retry / backoff | Bounded single retry, no jitter, no circuit breaker | acceptable for a client; noted |
| Resource bounds | 2 s connect, 5 s write, 4 s GET read, 180 s POST read, 20 s stream wake, 30 min cap, 16 MB body, 1 MB line, 64 KB header, 1024-byte chunk-size | `loom_http_raw` + `BodyDecoder` |
| Infinite loops | Reader is cancel-aware + deadline-capped; Loom turns bounded by `timeout_seconds` (enforced) | `run_stream` + Loom `context.WithTimeout` |
| Partial failures | Partial replies preserved and marked partial; error vs disconnection captions | `finishStream` |
| Concurrency | Overlapping sends settle independently; Stop adoption keeps the running stream; workflow attribution captured at start | `chat-lifecycle.test.ts`, `stream-consumers.test.ts` |
| Duplicate effects | The IDE performs no external writes; Loom owns side-effects; no replay path | architectural |

**Net:** reliable *as a client*. The one operational nuance is that Stop is
cooperative reader cancellation — it stops the IDE from listening, not Loom
from computing. This is documented and unit-tested, but it is a semantic
limit the user should see (the Stop label already says "cooperative").

## Security & human control

| Concern | Finding | Severity |
|---|---|---|
| Authentication | None — the IDE talks to `localhost` unauthenticated (DECISIONS: "no client auth until a non-local deployment names it") | P1 (accepted for local) |
| Gateway exposure | `looms` defaults to `0.0.0.0:5006`/`:60051` with wildcard CORS allowed — any host process or browser origin can drive the runtime | **P0** |
| Secret storage | None in the IDE; connection credentials stay in Loom's config and out of the UI | Good |
| Filesystem access | Workspace + vault enforce symlink rejection, external-edit refusal, atomic writes, `LOOM_VAULT_DIR` override (default checkout vault) | Good |
| Prompt injection | Context pack truncated + labeled untrusted; open-file content capped; Loom shelljail covers generated-code execution; IDE renders all Loom content as text | Adequate |
| Untrusted tool output | Loom admission + shelljail (server); the IDE treats streamed content as data (textContent) | Adequate |
| Least privilege | Loom decision layer + shelljail (server) | Adequate (server side) |
| **Autonomy enforcement** | Four levels stored, labeled, history-tracked — **not enforced by Loom** | **P0 (human control)** |
| Auditability | Run records (cost, source, partial, trace), evidence-kind labels, autonomy history | Good |

## The autonomy defect (QC-01), in the reference's terms

The reference is unambiguous: *"A visual autonomy control without
corresponding enforcement is a critical architectural defect."* Quiet
Complexity's four levels (`manual` → `assisted` → `collaborative` →
`delegated`) are stored, displayed, and history-tracked, and the dial copy
now states the honest truth ("Loom's runtime does not read this level yet")
— but **nothing on the execution path consults the level**. A human who sets
"Manual" and then sends a consequential request has no guarantee Loom will
not act. This is the single most important finding of this audit.

The resolution is layered and does **not** require changing Loom first:

1. **Client boundary (now):** gate which requests the IDE will even send,
   and which workflow/experiment/approval actions it will offer, by the
   active intent's level — a Rust-side enforcement the IDE fully controls.
2. **Runtime contract (later, Loom side, out of scope here):** specify a
   Loom permission/autonomy mapping so the runtime enforces it too. This is
   an upstream item, documented, not implemented.

## Approvals (HITL)

Cards now render the held-call parameters (as inert text, with the server-
supplied hold timeout) and route through the correct store
(`POST /v1/human-requests/{id}:respond`). The approval **route** is
live-verified; a full approve → tool-actually-executes round-trip has not
been executed against a held tool (no hook-held tool configured). The
reference's "bind approval to the exact action, resource, parameters, and
expiry" is honored for *display*, and the *enforcement* of that binding is
Loom's, source-confirmed but not live-tested.
