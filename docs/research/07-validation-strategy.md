# Deliverable 7 — Validation Strategy

No time-only success. Every claim below pairs a measure with a falsification target.

## Testable hypotheses

- H1: B-default (artifact/diff) yields higher fix correctness + lower review fatigue than A-chat for defect/PR tasks.
- H2: Explicit L0–L4 with Trust gates increases appropriate reliance (fewer overrides of good AI + fewer accepts of bad AI) vs binary auto/manual.
- H3: Per-hunk Apply + provenance links improve defect root-cause recall vs narrated-only plans.
- H4: Quiet attention (decision/exception only) lowers resumption cost vs event firehose.
- H5: Memory-consolidate gating + Trust updates reduce repeat defects without bloating Memory.
- H6: A→B→C graduation path onboards novices faster than B-only without capping experts.

## Prototype experiments

- P0 (no users): exact per-service RPC count (151 vs ~163); open Weave/chat-loop/session/eventlog/decision-router/MCP/config/storage gaps; raise `max_string_literals`; set `REA_PWNTOOLS_PYTHON` for layout; measure TPM-scheduler vs keystroke latency; MCP Apps interactivity spike; `internal/agent` vs `pkg/agent` split.
- P1: clickable B-default + A-mode prototypes; 4 scenarios (memory-latency, defect, PR review, experiment) with seeded Loom traces.
- P2: live `looms serve` PoC; L2 ambient in editor; L3 budgeted plans; L4 background digests.

## Measures

- Agency: override rate, take-over latency, autonomy-change frequency, `contact_human` usefulness.
- Cognitive load: NASA-TLX + secondary-task probe + chunk-count audit (4±1).
- Trust calibration: appropriate-reliance matrix (accept-good / reject-bad), Trust-score vs judge-pass correlation.
- Understanding: root-cause recall, provenance-trace task, "what ran and why" quiz post-task.
- Performance: correctness, defect escape rate, rework hunks, budget adherence.
- Skill growth: pre/post transfer tasks without AI; explanation-quality ratings; Memory-reuse rate.

## Methods

Within-subjects A/B/C on matched tasks; think-aloud for attention/resumption; log analysis for gates/denials/demotions/overspend; judge-score triangulation; longitudinal Trust tracking. Stop rules: budget caps, incident Evidence on Control violation, auto-demote events.

## Open definitions to lock in P1

Trust formula + scope (per-skill/agent/repo); nested-budget composition + raise authority; concurrent-write rule; L4 Evidence minimum; Memory-write approval threshold; denial/demotion surfacing; Intent-in-B placement; default concept + graduation path.
