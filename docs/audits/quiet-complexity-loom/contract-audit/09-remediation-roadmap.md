# 09 — Remediation roadmap

This is a plan for reviewed implementation, not authorization already exercised. No remediation code/configuration was changed in this audit. Keep vanilla TypeScript, Rust/Tauri and Unity; use existing handlers, stores and runtime services. Keep local manual work, central sphere and Q2 deferral. Do not add dependencies or migrate user data.

## Order and dependencies

| Stage | Independent work and dependencies | Exit gate |
|---|---|---|
| 0 — Contain/control | QC-02 deployment boundary; QC-01 explicit runtime policy contract and fail-closed command gate. Read existing admission/held-call primitives first. | Local profile is actually local; every consequential entry point has the same enforced scope. Advisory labels alone are interim, not completion. |
| 1 — Execution truth | QC-03 session/agent request format; QC-04 explicit success/error/partial/cancel semantics. These are prerequisites for credible runtime feedback. | Real two-agent/two-turn chat keeps identity, a server error never renders completed, and uncertain requests are not replayed. |
| 2 — Human decisions | QC-06 acknowledgement booleans is a small IDE fix. QC-07 needs an adapter to the existing held-request store, with approved transport, exact statuses and identity. | Counted tool waits; approve runs once; deny/expire never run it; pending requests survive/reconcile restart where backend supports that. |
| 3 — Gateway streams | QC-05 transport framing/envelopes and per-feature event schemas; QC-17 subscription lifecycle. | Workflow, session, pattern and provider A/B events update actual visible objects with errors/cancellation. |
| 4 — Management contracts | QC-08 agent envelope, QC-12 MCP envelopes, QC-21 model/owner routing and QC-22 app specs can proceed independently. QC-10 registers existing peer services; QC-11 fixes task bodies/list shapes before mutations are trusted. | Create/manage one isolated agent/MCP configuration; board/task/skill operations survive readback/restart with true rejection states. |
| 5 — Intent/context/evidence | QC-09 prove context at provider boundary; QC-13 capture run origin; QC-14 persist IDs and trace/evidence relationships. QC-15 guard stale artifact searches. | Intent → work → real run → artifact/tool/trace chain stays inspectable after client/server restart and navigation. |
| 6 — Local reliability/package | QC-16 explicit portable vault; QC-18 reliable watcher signature; QC-19 atomic layout. | Packaged client with absent build checkout preserves contained notes/layouts and reflects external changes without lost drafts. |
| 7 — Verify and describe | QC-20 updates current docs only after evidence. Run acceptance below, real-window checks and appropriate performance/security cases. | No advertised feature exceeds its tested contract; unverified/unsupported services remain explicit. |

Stage 0 can overlap small isolated contract fixes; it must precede trusting consequential live execution. Registering Task/Skills HTTP handlers is a Loom-side change outside this audit's allowed write scope; it is not an excuse to build a second task or skills engine. QC-07 similarly reuses HumanRequestStore instead of implementing frontend approval policy.

## Per-capability completion ledger

Report 03 gives a specific next acceptance case for each feature. For **each included supported Loom capability**, retain all of: UI action/source; exact service/interface and configured availability; request/response schema; authoritative IDs; visible real success; real error/empty behavior; permission boundary; persistence/readback after restart; artifact/trace/evidence access where applicable; repeat/cancel/concurrency evidence. Only then label it FULLY INTEGRATED.

| Representative end-to-end workflow | Mandatory observations |
|---|---|
| Intent + chosen agent + two chat turns | Persist intent/work, use non-default agent, same server session both turns, actual provider/tool evidence, correct UI text, immutable origin on selection changes |
| Contextual code assistance | Open a contained file, inspect exact bounded context sent to provider, receive answer, keep manual explicit-save/external-edit rules |
| Human approval and interruption | Start a harmless counted held tool; inspect arguments/reasons, approve once, deny another, expire another, Stop a running test; observe backend acknowledgements and absence of post-denial effects |
| Agent/model/tools/MCP lifecycle | Review valid config, create/list/start/stop/reload; switch selected session model and verify effective backend provider/model; failed MCP test stays failed; tools schema/result remains inspectable |
| Workflow + schedules | Start from work A, navigate B, keep A ownership; inspect real execution output/error; schedule/pause/resume/trigger only in contained profile; verify cancel semantics |
| Experiments/provider comparison | Run genuinely different enforced configurations/providers; preserve returned metrics/evaluation provenance; distinguish generated explanations from observed tests; do not score prose as measurement |
| Task board/skills | Configured services expose routes; create/update/claim/release/transition/dependency/decompose/readback; reject conflicts; import bounded real test skill and confirm router behavior/error |
| Artifacts/evidence | Produce a real contained artifact, list/search/View exact bytes, attach to origin, inspect trace/tool/test evidence, restart both processes and re-open the same chain |
| Knowledge + Unity + offline manual work | Open contained vault; local edit/review/history/archive/restore and external edge update; exact host navigation/counts/theme/motion/state; no artificial data when Loom disconnects |
| Recovery and limits | Simulate disconnect/malformed/partial/duplicate/reordered frames; recover actual pending state; page beyond list caps; verify UI fails honestly without losing drafts |

Use real contained test artifacts/inputs, never seed production views to look functional. A stub provider can verify contracts and failure paths but cannot count as real-model end-to-end evidence. The actual Tauri window matters: browser fallback alone cannot validate invoke permissions, local filesystem or the packaged WebGL path.

## Gated supported capabilities beyond the current surface

GraphMemory, MemoryLayer, Judge evaluation, Learning, Teleprompter, full ToolRegistry and LLM scheduler require the existing transport/product decision. Bus/shared memory, artifact upload/delete, template apply and scripts also need a clearly stated human workflow before exposure. Record these as supported-but-not-integrated, not broken current widgets. Persistent judge history is unsupported in the inspected implementation and cannot be promised by a UI wrapper.

“Full integration with supported capabilities” is a **declared capability set**, not every imaginable IDE feature. Publish the inclusion/exclusion ledger, reasons and tests. Within the declared set, no UI-only policy, silent contract mismatch or unexecuted acceptance case may remain. Expanding that set requires the same evidence bar; hiding an important capability for visual minimalism is not completion.

## Remaining blockers and how to unblock

- Focused Loom tests: cached testify 1.12.1 is absent; provide a prepopulated dependency cache under the no-install rule or authorize dependency setup in a later task. No production code change is appropriate.
- Live UI/model/cancel/restart acceptance: provide an accessible actual Tauri surface and a contained configured backend/provider with harmless bounded tools and owned artifacts. Existing personal sessions are not an isolated acceptance environment.
- Full remote-only service coverage: resolve the already documented transport decisions and authorize the narrow Loom gateway/store adapters in their own repository task.
- Real-window visual/GPU verification: restore a working UI observation channel and test on the target hardware; CUA opening timed out in this audit.

No question or approval checkpoint is left pending. The next engineering work is fully specified in the issue files and should start only after audit review, as requested.
