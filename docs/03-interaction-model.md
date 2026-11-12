# 03 — Interaction Model

*The objects people work with, how they relate, and how control moves between
person and system. No code — this is the contract the concepts in
`research/04-ux-concepts.md` share.*

## The fundamental objects

The unit of interaction is **not** a chat message. It is a work object with
state, evidence, and a control setting. Chat remains available as a way to
*create and discuss* objects — never as the place objects live.

### Primary objects (the person touches these daily)

| Object | What it is, in plain words | Lives in Loom today as |
|---|---|---|
| **Intent** | What the person wants, why, what "done" means, and how much freedom the system has. One intent owns many pieces of work. | Closest: a Weaver request, a task-board goal (`documentation/architecture/task-system.md`, `weaver-system.md`) — but neither is a persistent, person-owned object yet. |
| **Work** | One piece of work toward an intent: investigate, fix, review, run an experiment. Has state, blockers, and an owner (person, system, or shared). | Tasks on the task board: persistent, dependency-aware, with OPEN / BLOCKED / DONE-style states and claim/close actions. |
| **Artifact** | Something made or changed: agent, workflow, skill, report, code change, dashboard. Versioned and openable. | Agents/workflows/skills as YAML; artifacts store; MCP Apps served at stable `/apps/<name>` addresses (`documentation/guides/mcp-apps-guide.md`). |
| **Evidence** | The proof or record behind a claim: test result, trace, judge score, measurement, source link. Always attached to the object it supports. | Observability traces and spans; judge scores; pattern usage records. Today these exist for the system, not yet presented for the person. |
| **Control** | The settings that decide what the system may do without asking: autonomy level, budget, allowed tools, timeout behaviour. Visible on the object it governs. | `contact_human` requests, workflow HITL gates, learning autonomy modes, decision-layer bands (`documentation/guides/human-in-the-loop.md`, `documentation/reference/agent-configuration.md`). Real — but scattered. |

### Supporting objects (real, but one layer down)

| Object | Role in the model |
|---|---|
| **Context** | What the system is using to think with: files, patterns, memory, prior decisions. Must be inspectable ("what are you basing this on?") and correctable. |
| **Memory** | What persists between sessions. Loom documents a 5-layer memory (ROM, kernel, recent, summary, long-term store). The person should be able to see what is remembered about their work and delete it. |
| **Uncertainty** | Not an object but a property of every claim and plan: stated plainly ("confident", "unsure — two patterns match"), never as a bare percentage with no basis. |
| **Provenance** | Who or what produced this, from which inputs, when, under which settings. Every artifact and inferred claim carries it. |
| **Permissions** | What the system may touch: files, tools, network, money (cost budget). Set per intent, shown before anything runs. |
| **Knowledge / Pattern** | Reusable know-how (Loom patterns and skills). An object the person can open, correct, and see the track record of. |
| **Trust** | Not a setting — an outcome. The interface supports it by showing track record (past evidence) rather than asking for it. |
| **Identity** | Which agent or person did this. Shown in provenance; agents are named by role ("researcher"), never dressed as people. |
| **Time** | Every object shows age and last change. Stale evidence looks stale. Checkpoints make "go back to before this" a normal action. |
| **Collaboration** | More than one person (or a person plus system) on the same object, with clear ownership per piece of work. Loom's task system explicitly does *not* yet solve simultaneous human/agent editing of the same task — flagged as a gap in `research/05-loom-assessment.md`. |

## Relationships

```
Intent ──owns──▶ Work ──produces──▶ Artifact
  │                │                    │
  │                └──supported by──▶ Evidence
  │                                     │
  └──governed by──▶ Control      Provenance attaches to
        (autonomy, budget,       Artifact + every
         permissions)            inferred claim
```

Rules:

1. No Work exists without an Intent (even if the intent is one line the
   person typed and accepted). This is what stops "the agents did something"
   with no answer to "why?"
2. No Artifact is presented as finished without Evidence or an explicit
   "unverified" label.
3. Control set on an Intent is inherited by its Work and can be tightened on
   any piece of Work — never loosened below the Intent's setting without the
   person doing it.
4. Evidence never floats free. It is attached to the claim it supports, so
   deleting the claim shows what proof goes with it.

## Actions (verbs the person always has)

On **any** object, at any time:

- **Inspect** — see state, provenance, context, and evidence, one layer down.
- **Correct** — edit an inferred claim, a chosen pattern, a plan step. The
  correction is recorded and the system continues from the corrected version.
- **Pause / Resume** — freeze work without losing state.
- **Interrupt** — stop a running step now. Distinct from pause: it cancels
  the current tool call or model turn where Loom allows cancellation.
- **Rewind** — return an artifact or workflow to a previous checkpoint.
  Loom's workflow checkpoints already survive process exit and refuse to
  resume if the workflow definition changed since the checkpoint — rewind
  builds on exactly that honesty.
- **Change the dial** — raise or lower autonomy for this object, effective
  immediately for everything that has not started yet.
- **Take over** — drop to Manual and do the step by hand, leaving the
  object's state intact for the system to read afterwards.

## The autonomy continuum

Five levels, set per Intent and adjustable per Work item:

| Level | Name | What happens | Example in Loom terms |
|---|---|---|---|
| 1 | Manual | System advises only when asked. Person does the work. | Reading a pattern and writing YAML by hand. |
| 2 | Assisted | System prepares in place: suggestions, drafts, completions. Person applies each one. | Pattern recommendation shown; person runs it. |
| 3 | Collaborative | System and person interleave steps. System asks at judgement points it cannot evidence. | Workflow with HITL gates between stages. |
| 4 | Delegated | System completes the whole intent within budget and rules; person reviews the result and exceptions. | Task DAG executed; `contact_human` only on exceptions. |
| 5 | Autonomous | System runs and self-corrects within hard limits; person sees a summary and can rewind. | Learning autonomy mode "full" with circuit breaker. Highest risk; never the default. |

### Movement rules (the heart of agency)

1. **Moving down is instant and unconditional.** One action, no confirmation
   dialog, no penalty. Anything not yet started obeys the new level.
2. **Moving up is deliberate.** It requires the person to see: what will no
   longer be asked, the budget, and the recent evidence at the current level
   ("last 12 delegated runs: 11 verified, 1 corrected").
3. **The system may propose, never apply, an increase.** A proposal is a
   Decision-Required card with evidence — dismissing it is free and is not
   remembered against the person.
4. **An anomaly moves the dial down automatically — and says so.** If a run
   behaves unexpectedly, autonomy for that intent drops one level and the
   person is told what happened and why. Trust is rebuilt by behaviour, not
   by messaging.
5. **Level 5 expires.** Autonomous settings carry a review date. Quiet
   systems must not accumulate permanent permissions by neglect.
6. **Shadow before live.** Following Loom's own decision-layer pattern
   (record-only shadow mode before a site may act), any *new* kind of
   automated decision runs in shadow first: it records what it *would* do,
   the person compares, and only then may it act.

## The three attention states (interaction contract)

### State 1 — Normal operation (quiet)

- The surface shows Intents and Work with state. Nothing animates for
  routine progress.
- Working indicators appear only on the object being worked on, as plain
  state ("running tests — 4 of 9"), never as theatre.
- Keep-alive and "a hold is coming" signals from Loom are **never** shown.
  Per `documentation/guides/human-in-the-loop.md`, only a human-in-the-loop
  request with a non-empty request id is answerable; the other shapes must
  stay invisible. Showing them creates answer boxes that go nowhere.

### State 2 — Decision required

One card, attached to the object that needs it, containing exactly:

1. **What** is being asked (approve / choose / provide / review — Loom's
   four request types).
2. **Why now** — what finished, what is blocked on this.
3. **Evidence** — the artifacts, results, or measurements behind the ask.
4. **Alternatives** — including "do nothing / cancel" and what each costs.
5. **Consequences** — what happens on approve, on reject, on timeout
   (Loom gates already define timeout behaviour: fail, reject, or approve —
   it must be stated on the card, not discovered later).
6. **Uncertainty** — what the system does not know, in words.
7. **Deadline** — when the timeout fires and what happens then.

### State 3 — Unexpected behaviour

- The anomaly appears **on the object where it happened**, not in a global
  feed: failed step, cost spike, judge disagreement, checkpoint mismatch.
- Three actions are always present: **Inspect** (evidence and trace),
  **Interrupt** (stop now), **Recover** (rewind to checkpoint or hand the
  step to the person).
- The autonomy dial for the parent Intent drops one level (Movement rule 4)
  and the card says that plainly.

## How work moves (one example, end to end)

Scenario B (defect investigation) in this model:

1. Person states an Intent: "Find why session resume sometimes replays a
   tool call." Success check: "a failing test that passes after the fix."
   Autonomy: Collaborative.
2. The system proposes Work items (reproduce, locate, fix, verify) — the
   person edits the list before anything runs. This mirrors Loom's task
   decomposer, but the proposed graph is shown and editable *before*
   materialising, not after.
3. "Reproduce" runs at Collaborative: the system drafts a test, the person
   approves it (Decision card with evidence: the failing output).
4. "Locate" produces an inferred claim — labelled **Inferred**, with the
   trace attached as **Recorded** evidence. The person corrects the claim;
   the correction becomes part of Context.
5. "Fix" produces an Artifact (code change). "Verify" attaches Evidence
   (test run). Only then may the Work item close — matching Loom's
   end-of-turn hygiene idea that tasks may not be left incoherent.
6. The Intent closes with a summary that separates what was observed, what
   was recorded, what was inferred, and what remains unknown.

Chat was used in steps 1–4 as a writing aid. At no point was the chat
transcript the record. The objects are the record.

## What this model refuses

- A run with no Intent. ("Just do it" is still an Intent — a short one the
  person confirms.)
- A claim with no kind label (observed / recorded / inferred / unknown).
- An answer box with no request behind it.
- An autonomy increase the person did not make.
- A "done" with neither evidence nor an "unverified" label.
