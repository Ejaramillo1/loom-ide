# Deliverable 8 — Phased Roadmap

## Phase 1 — Research and conceptual validation

- Lock open definitions: Trust formula/scope, budget composition, L4 Evidence minimum, Memory-write rule, denial UX, Intent-in-B placement, default + A→B→C path.
- Run P0 source/REA spikes (Weave internals, chat loop, session/eventlog, decision router, MCP, config, storage, LSP split, HITL resume, scheduler latency, evals, apprentice/weaver, MCP Apps interactivity).
- Prototype A/B/C click-throughs; test 4 scenarios with seeded traces; agency/load/trust studies.
- Decision gate: B-default + A-mode + C-advanced confirmed or revised; Loom integration boundaries frozen; no production code yet.
- Risks: unvalidated agency/load/trust claims; TPM latency kills ambient L2; LSP stub forces separate scope.

## Phase 2 — Interactive prototyping and user testing

- Build B-default (diff-first, per-hunk Apply, provenance, FTS5) + A-mode (Intent chat) against live `looms serve`; C-canvas as limited advanced view (≤30 cards, grouping enforced).
- Implement thin Agentic-Control: Intent/Work/Trust/budgets migration, L0–L4 policy, gates/checkpoints, `contact_human`, demotion/incident paths.
- Wire observability decision views (gates, denials, overspend, judge fails); enforce `-tags fts5`, proto-first, `-race`, tracing.
- Decision gate: H1–H6 supported; appropriate-reliance + understanding improve; review fatigue drops; graduation path usable.
- Risks: concurrent-write serialization; budget composition across nested Work; Memory bloat; canvas clutter.

## Phase 3 — Technical proof of concept on Loom

- Harden PoC: crash-only resume via eventlog/checkpoints/park; PG RLS multi-tenant path or explicit single-tenant SQLite scope; auth interceptor + Supabase where required.
- Extend via Loom-native seams only: new shuttle.Tools, skills/patterns, judges/teleprompter, MCP servers, Lua tools, MCP Apps panels; no agent-runtime fork; no admission/permission/shelljail bypass.
- Shipbench: defect/PR/experiment suites + LongMemEval reuse where scoped; Trust-gated L0→L4 in real repos.
- Decision gate: PoC runs bounded L4 with digests; incidents auto-demote with Evidence; upgrade path (`looms upgrade`, `VACUUM INTO`) clean; packaging (brew/choco/scoop/winget) + release matrix + distroless runtime verified.
- Risks: release-vs-dev drift (bin/ are pseudo-version dev builds); Docker/ACR refs uninspected; string-literal/layout coverage gaps; per-provider LLM quirks.

## Dependencies

Loom `looms serve` stability; proto/buf discipline; FTS5 builds; scheduler latency spike; LSP decision; MCP Apps interactivity spike.

## Non-goals until gates pass

No IDE implementation in P1; no Loom fork; no auth weakening; no silent autonomy creep; no event-firehose notifications.
