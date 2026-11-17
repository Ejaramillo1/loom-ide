# 11 — Lessons from Awesome Agentic System Design, applied to Quiet Complexity × Loom

Source: [gtzheng/Awesome-Agentic-System-Design](https://github.com/gtzheng/Awesome-Agentic-System-Design)
(MIT-licensed curated hub; its original docs are the reference material —
`docs/architecture.md`, `docs/context-and-memory.md`,
`docs/tools-and-protocols.md`, `docs/evaluation.md`,
`docs/production-and-safety.md`). Concepts are adapted, not copied; every
application below is anchored to this repo's verified audit findings
(`00`–`10`, issue IDs, QC refs) and the roadmap (`09-remediation-roadmap.md`).

## 1. Why this reference is worth our time

Its core frame matches the Quiet Complexity philosophy almost point for
point: *a workflow defines control flow in code; an agent loop delegates
choices to a model; most useful systems combine both* — and the design
work is "the software around that loop: state, context, permissions,
execution, evaluation, observability, failure recovery." Three of its
sentences could be Loom-hook citations in our philosophy:

- "Separate a model's proposed action from the runtime's authority to
  execute it."
- "A fluent answer does not prove a task was completed. A tool call that
  returned successfully does not prove the action was appropriate."
- "Prompt instructions and model-based filters can reduce risk, but they
  do not replace authorization or isolation."

The audit proved the same truths empirically (QC-04 misreported
completion; QC-01 advisory autonomy; QC-09 inert context). This document
turns the reference's checklists into concrete, smallest-possible changes
for our system.

## 2. The run contract — and where it lands in our system

The reference defines a run contract: **input, goal + required evidence,
allowed actions, state (run ID, status, plan, evidence, action ledger,
remaining budget), limits (deadline, turns, tool calls, spend,
delegation depth), completion (verified outcome / clarification /
handoff / failure), output (answer, evidence, receipts, limitations)**.

Our Intent object already covers goal, success criteria, and autonomy.
What it lacks is **limits** and **the action ledger**. Two of those fields
map to `WeaveRequest` fields the IDE *already has the right to send but
never sends*:

| Contract field | Our hook | Today | Apply |
|---|---|---|---|
| Deadline / turn budget | `WeaveRequest.timeout_seconds` (default 300), `max_rounds` (default 3) | **never sent** — every turn runs server defaults | Add "budget" and "max rounds" fields to the Intent editor; send them per turn. This is the *smallest real backend-enforced control* — it makes the dial govern something the server actually enforces, a first honest step toward QC-01 |
| Spend limit | per-turn `cost` already arrives on every completion event (live capture: `total_cost_usd`) | **discarded** — `ChatReply` has no cost field | Surface per-turn cost in chat + a running total on the work item. Philosophy: "cost spikes — these interrupt, clearly." A quiet cost display is a philosophy bug |
| Action ledger | `executionWorkIds`/`experimentWorkIds` in-memory maps | lost on restart (QC-13/14) | Persist a run record per execution (see §4) |
| Completion semantics | fixed at `b1f16bd` (stage-7 required) | ✅ done | Keep the terminal-state rule as a contract test |

## 3. Durable execution vocabulary — adopt the lifecycle

The reference's lifecycle — `queued → running → waiting_for_input/approval
→ running → succeeded/failed/cancelled` — matches Loom's own park-and-resume
holds, and is more truthful than our current work-item status
(`active/paused`). Apply it to the *workflow execution surface* (not the
local work model): render execution status in these seven terms, with
`waiting_for_input/approval` driven by the HITL hold state (which we can
now see from the stream). This gives the user the "where is my run
actually stuck" answer that today's poll-based list cannot.

Also adopt the reference's **approval rule** verbatim as an issue:
*"Bind approval to the exact action, resource, parameters, and expiry;
revalidate before execution. A timeout must reach a defined state; it must
not imply approval."* Our HITL card shows only question + Approve/Deny
(`main.ts:5104`). `HITLRequestInfo` already carries `timeout_seconds`,
`context_json`, and `options` — the card should show **what will be run
(with parameters), when the hold expires, and what happens on expiry**.
This closes the gap between our philosophy's Decision-card spec
(which already demands consequences + deadline) and the implementation.
Folds into the QC-07 approval work.

## 4. Memory and context — the six-way split

The reference separates **task context / execution state / knowledge /
episodic memory / user preferences / procedural knowledge** — different
correctness and retention per category. Our system has a working analogue
of the third and fifth (vault notes + appearance), a broken fourth
(QC-09: the context pack never reaches the agent), and no second
(execution state — QC-14).

Two concrete applications:

1. **Context pack shape.** When QC-09 is resolved, build the pack as the
   reference's *structured continuation record* instead of today's flat
   key-value map: goal + constraints, completed steps with receipts,
   current hypotheses **marked unverified**, evidence references with
   timestamps, pending approvals, next step + remaining budget. This is
   also exactly the shape the philosophy's "labelled claims" concept
   needs on the wire.
2. **Vault kinds.** Map vault note kinds to the six categories and store
   the category with the note (`episodic` vs `inference` vs `fact` vs
   `preference`). The reference's rule — *"an earlier error is not
   promoted to fact"* — is our evidence-kind system (observed/recorded/
   inferred/unknown), already rendered in Evidence; extend the labels to
   the note model, and treat "memories as data: they must not override
   permissions or trusted instructions" as a written rule for the
   proposed-memory review flow (the Memory garden already gates approval
   on linked evidence — keep it).

## 5. Trust boundaries — confirm and extend

The reference's boundary table, checked against our system:

| Boundary | Our status | Action |
|---|---|---|
| Retrieved content → model | Loom's own concern (tools read files/web); IDE renders all Loom content via `textContent` — safe | Document the rule: *all* streamed/artifact/app content is untrusted data (reinforces the injection discipline for future code) |
| Model → tool | Loom admission chain + shelljail (server-side) | Our autonomy mapping (QC-01) is the client half — see §2 for the first enforceable step |
| Approval → action | **gap**: card shows no parameters/expiry | §3 card fix |
| Tenant isolation | single-user local; vault is per-user | Keep vault/store scoped per app-data dir (QC-16's checkout-path bug is the thing to fix here) |
| Generated code → environment | Loom `shell_execute` jailed | Fine; do not weaken from the IDE |

One item our audit didn't flag: the Apps tab opens Loom-served HTML
(`/apps/{name}`) via `window.open` into a *browser* window — arbitrary
server HTML running **outside** the webview's CSP (issue 010). Treating
those pages as untrusted (and documenting why they must not be embedded
in the IDE window) is a one-line doc decision; embedding them in an
origin-isolated iframe would be the safer later step.

## 6. Evaluation discipline — turn the judge into a case harness

The reference's evaluation checklist reads like the missing second half of
our `judge/` tooling:

- **Case files** with: case ID/category, input, initial state, permitted
  actions, expected final state, **prohibited changes**, grader + rubric,
  pinned model/prompt/tool/runtime versions, budget, trial count, traces,
  receipts, cost.
- **Measure more than completion**: safety violations, grounding/citation
  correctness, consistency across trials, recovery (duplicate effects,
  resume success), cost per accepted task, unnecessary clarifications.
- **"Keep judge inputs separate from untrusted agent text; agents must
  not be able to rewrite the grading policy."**

Apply: extend `judge/JUDGE_PROMPT_TEMPLATE.md` to the case-file format and
add "prohibited changes" + a grounding check to every verdict. The
evaluation's own safety rule (judge policy is not agent-editable) should
be written into the template header. This turns our Evidence surface
(eventually) from "summaries + labels" into a measurable acceptance loop —
the philosophy's "Judges score; evidence proves."

Also adopt the release ladder from the reference when any of this ships:
offline regression set → shadow mode → limited rollout — Loom already has
shadow-mode machinery server-side (decision layer), so the philosophy's
"shadow before live" rule has a real hook.

## 7. Protocol discipline — pin versions

The reference's MCP/A2A version warnings map directly to QC-12 (MCP
contract decodes) and our MCP surface: **pin the MCP spec version** in the
IDE docs and show the negotiated protocol version in the MCP server
row (when Loom reports it). "A link labeled `latest` can change" — our
MCP decode logic currently hand-parses three different response shapes;
version-pinning is what keeps that from drifting silently again.

## 8. What NOT to apply

The reference is generic-agent-engineering; Quiet Complexity's
differentiators must survive it:

- **No new eval infrastructure** until the judge case harness (§6) proves
  need — Loom's judges already exist.
- **No budget/turn knobs on the main surface** — limits belong inside the
  Intent object (one layer down, per the philosophy), not on the chat bar.
- **No multi-agent orchestration UI** — Loom's orchestrator patterns
  (pipeline/parallel/debate) surface through workflows; do not build a
  second orchestration concept in the IDE.
- **No generic RAG pipeline** — retrieval is Loom's; the IDE's job is the
  *inspectable* context record (§4.1), which is a display/contract task.

## 9. Prioritized application list (smallest first, mapped to the roadmap)

| # | Change | Size | Maps to | Phase |
|---|---|---|---|---|
| 1 | Send `max_rounds` + `timeout_seconds` from the Intent (fields already in `WeaveRequest`) | S | QC-01 first enforceable step; issue 005 | Phase 3 |
| 2 | Surface per-turn cost + work-item running total (data already on the wire) | S | philosophy "cost spikes never quiet"; issue 008 family | Phase 1 |
| 3 | HITL card shows parameters + expiry + timeout consequence | S | QC-07 adjacent; philosophy Decision-card spec | Phase 1 |
| 4 | Persist execution records with the 7-state lifecycle vocabulary | M | QC-13/14; issue 006 | Phase 4 |
| 5 | Context pack → structured continuation record with unverified-hypothesis markers | S–M | QC-09; philosophy claim labels | Phase 2 |
| 6 | Vault note categories (six-way split) + "memories never override permissions" rule | S | knowledge model; graph-memory gap | Phase 4 |
| 7 | Judge case-file format + prohibited-changes + judge-isolation rule | M | `judge/` tooling; evidence chain | independent |
| 8 | Pin MCP spec version; show protocol version in MCP rows | S | QC-12 | Phase 2 |
| 9 | Document `/apps` pages as untrusted external content (no in-window embed) | XS | issue 010 adjacent | Phase 5 |

None of this needs a new framework, a Loom-side change beyond the already
planned registrations, or any weakening of the quiet surface. It is the
reference's best material, translated into this product's vocabulary.
