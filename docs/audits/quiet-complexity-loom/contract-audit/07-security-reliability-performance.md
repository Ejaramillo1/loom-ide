# 07 — Security, reliability and performance

## Security boundaries

The highest-priority observed deployment risk is QC-02: this gateway is not restricted to localhost, while the connection model assumes a local trusted server. Read-only probes accepted no credentials and allowed an unrelated Origin with wildcard CORS. The source custom SSE handler directly invokes the runtime. This audit did not execute an unauthorized tool, test a LAN attack, enumerate secrets, or change the service configuration. Bind/CORS/auth containment and a unified identity check are the smallest operational correction before remote support.

QC-01 is a separate execution-control failure: local autonomy inheritance/justification/history validate planning records but cannot authorize or prohibit a runtime tool. QC-07 is also separate: a held request exists in a store the UI does not answer. A decorative approval button is not a permission boundary.

Positive inspected boundaries include workspace canonical containment, 1 MB/binary checks, external edit comparisons, note-vault symlink rejection, proposal-only agent note writes, evidence-linked human review, atomic note/journal recovery and percent-encoded IDs. Existing tests exercise these. Concurrent hostile symlink replacement between validation and write, OS-level access outside the chosen workspace, sandboxing of arbitrary agent tools, and every MCP executable's behavior were not security-tested. Those require a contained threat-model test, not a speculative exploit report.

Tauri exposes 139 frontend-wrapped commands in its main window. Server actions include process/agent management, MCP executable configuration, storage migration and TLS renewal; main-window code is trusted with substantial authority. CSP is null. Inspected response/artifact paths use textContent or escaping rather than raw model HTML. No demonstrated stored-XSS path was found; null CSP increases consequences of a future injection, not proof of one. Secrets were not dumped or written to evidence. Server config evidence retains network/TLS booleans only.

## Reliability

| Area | Observed behavior | Required result |
|---|---|---|
| Transport | Unary has size/status checks, timeout and GET-only retry; streams lack correct multi-protocol/terminal handling | QC-03/04/05; application success must be distinct from 2xx/EOF |
| Identity | Session ownership is enforced in Loom when provided, but SSE loses chosen fields | QC-03; authoritative identities must survive request and response |
| Human decisions | Wrong acknowledgement shape and wrong backing store for approvals | QC-06/07; accepted/expired/denied must be authoritative |
| Idempotency | IDE does not replay uncertain POSTs; Loom has turn dedupe keyed by incoming idempotency metadata | Keep at-most-one visible submit semantics; define retry IDs before enabling automatic turn replay |
| Cancellation | Stop sets per-request flag; read wakes up to about 20 s; closing connection can cancel server request context | Actual model/tool interruption and post-cancel side effects NOT VERIFIED; never equate a socket flag with stopped work |
| Persistence | Local work/vault safety tested; origin/trace relations are frontend-only; canvas writes directly | QC-14/19; persist IDs and retain last good bytes |
| State sequencing | Completion uses current work; old artifact search can overwrite new; old session streams survive | QC-13/15/17; use captured origin and request generations |
| Failure recovery | Local experiment running arms reset on load; note journal replay is tested | Still require interrupted backend workflow/resume/restart acceptance; local reset is not backend cancellation |
| External changes | Vault max-mtime signature ignores hidden ledger; polling reopens/parses vault | QC-18; derive an accurate bounded signature without losing draft/recovery rules |

## Performance

Expected load is one local user with a moderate personal vault and concurrent backend operations. No numeric throughput/latency/GPU target was specified; none is invented.

Measured build evidence: frontend build succeeded; large Monaco entry/worker chunks and Vite size warnings are in the log. wasm/data sizes are in report 06. These are package sizes, not startup/frame-time measurements. No new dependency is needed to fix the integration defects.

Source hot paths worth measuring are the 3-second vault signature that opens/parses notes, graph layout/render for growing collections, multiple selected-session subscriptions, repeated refreshes on stream events, and hidden Unity rendering. At 1000 near-cap 1 MB notes, full body scans can read roughly 1 GB each poll; that is a bounded worst-case calculation, not an observed benchmark or the assumed normal vault. The smallest improvement is a metadata/revision signature and cancellation cleanup, not a database migration or event framework.

Unary response cap is 16 MB; it can reject large legitimate artifact bodies and should report that clearly. Stream lines/event buffers have no equivalent explicit size cap; a misbehaving local backend could grow memory until timeout. Include bounded-frame and slow-byte tests in QC-04/05 rather than add a speculative separate performance issue. OS socket timeouts do not establish exact end-to-end deadlines under every drip-feed pattern.

Verdict: execution control, truthful terminal state and deployment containment matter before visual optimization. Performance claims remain bounded to source analysis and measured build sizes until real hardware measurements exist.
