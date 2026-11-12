# Deliverable 4 — UX Concept Exploration

## Concept A: Intent-Centered Workspace

- Interaction model: conversation-first; user states/refines Intent, AI decomposes into Work and narrates progress against acceptance criteria.
- Primary objects: Intent, Work plan, Evidence checklist; Artifacts secondary via plan nodes.
- Human–AI: high-narrative visibility (plan, current step, reasoning summary, confidence); low artifact chrome.
- Control: per-step Approve/Edit/Reject + autonomy slider; gates inline in chat flow.
- Complexity: progressive disclosure (collapsed steps, expandable evidence); intent versions diffable.
- Minimalism: Hara vessel empty-states; Maeda SHE; Barragán refuge mode for focus.
- Feasibility: highest — maps directly to Weaver + Loom TUI mental model.
- Risks: chat bloat, intent drift, weak artifact orientation for large codebases.
- Advantages: lowest learning curve; best for vague goals and research.

Wireframe:

```text
+--------------------------------------------------+
| Intent: cut p99 by 20% [v3] [Acceptance] [L2]    |
| Plan: [x] baseline [>] matrix [ ] analyze        |
| Step 2/5: running trials (budget 12/40) [Pause]  |
| Evidence: run-14 log, trace-9 [open]             |
| [Approve step] [Edit] [Take over]                |
+--------------------------------------------------+
```

## Concept B: Artifact-Centered Workspace (recommended default)

- Interaction model: editor/diff-first; Intent lives as pinned header; all AI action manifests as reviewable deltas.
- Primary objects: Artifacts + diffs + Evidence annotations; Work as artifact activity feed.
- Human–AI: ambient visibility (gutter badges, inline suggestions, confidence chips); narration on demand.
- Control: Apply/Reject per hunk, sandbox preview, per-file trust; gates at artifact boundary.
- Complexity: artifact tree + FTS5 search + provenance links; filters by owner/status/risk.
- Minimalism: Rams unobtrusive; Judd honest materials; Vignelli grid; Martin muted tones.
- Feasibility: high — builds on familiar diff/review + Loom artifacts/provenance.
- Risks: intent becomes invisible; multi-artifact plans hard to follow; review fatigue on sweeps.
- Advantages: best for defect fix and PR review; precise control; evidence co-located with code.

Wireframe:

```text
+--------------------------------------------------+
| Intent: fix login race [pinned] [Evidence 4]     |
| src/auth.go  +12 -3  [Apply hunk] [Sandbox]      |
|   gutter: AI badge 92% observed | test green     |
| Activity: repro → bisect → fix → race green      |
+--------------------------------------------------+
```

Open question: Intent placement in B — pinned header vs side rail vs commit-trailer. Needs P1 test.

## Concept C: Collaborative Spatial Workspace (advanced)

- Interaction model: shared canvas of Intent/Work/Artifact/Evidence/Control cards; agents as avatars owning cards.
- Primary objects: all five peers on canvas; edges show Intent→Work→Artifact→Evidence lineage + owner.
- Human–AI: presence (who owns what, live status, cost) + card narration; global activity rail.
- Control: drag card between L0–L4 swimlanes; per-card gates; one-click take-over/assign.
- Complexity: zoom (canvas→card→diff); swimlanes by Work state; filters by agent/risk/staleness.
- Minimalism: SANAA permeable panes; Mies open plan; Pawson calm proportion.
- Feasibility: lowest — new canvas + presence + grouping; clutter past ~30 cards without discipline.
- Risks: spatial overhead; build cost; concurrent-write serialization unsolved.
- Advantages: best for multi-agent experiments, debate/swarm; shared mental model.

Wireframe:

```text
+--------------------------------------------------+
| L2 lane | L3 lane | Review lane                  |
| [Work-A avatar] → [Artifact] → [Evidence]        |
| Intent card pinned top; Control gate on edge     |
+--------------------------------------------------+
```

## Recommendation

Ship **B as default** (senior-dev familiar, precise, evidence co-located) + **A as onboarding/research mode** + **C as advanced multi-agent view**, with one-click A→B→C graduation. Default for new users and graduation path need P1 validation.

## Scenarios

### A: agent memory-latency research
1. Human states Intent + acceptance (p50/p99 method, dataset, repro budget).
2. AI L2 proposes experiment matrix + cost; human approves → L3.
3. AI L3 runs trials; raw logs as Artifacts; configs/traces as Evidence per run.
4. AI synthesizes table + confidence + threats; human challenges one cell → narrow re-run.
5. Human accepts; AI consolidates into Memory graph + reusable pattern.

### B: software defect
1. Human pastes failing test/stack; AI L1 reproduces or asks for env gap.
2. AI L2 bisects via provenance; proposes minimal fix diff + root-cause chain.
3. Human reviews hunk-level diff → Apply/Edit; AI runs full file + `-race`.
4. Green → attach test Evidence, Intent done; red → auto-demote and re-propose.

### C: pull request review
1. Human assigns PR + rubric; AI L2 loads diff, runs linters/tests, per-file findings with Evidence.
2. AI separates blocking vs nit; cites provenance; proposes fix hunks without applying.
3. Human accepts/rejects per finding; AI batches accepted fixes into one diff for Apply.
4. AI records decision + rationale as Memory; updates Trust for author-agent.

### D: agentic experiment
1. Human writes scope charter (hypothesis, arms, budget, stop rules); AI validates budget/feasibility.
2. AI L3→L4 spawns parallel arms (fork-join/swarm); each owns Work card with status/cost.
3. Judges score arms; Control auto-pauses overspend/failing arms, notifies human.
4. Human kills/merges arms, approves winner; AI archives arms as Artifacts + Evidence ledger.
5. AI proposes pattern/skill update; human approves before auto-apply.
