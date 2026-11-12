# 01 — Design Philosophy: Quiet Complexity

*A front end for Loom designed around human intention, not around agents.*

## The one-sentence position

Loom already knows how to run agents, score them, remember them and ask a
person questions. What it does not yet have is a place where a person and the
system share the same work. This design builds that place: a quiet surface
where intent is stated once, work is visible as objects, evidence sits next to
every claim, and a person can always see — and change — how much freedom the
system has.

We call the philosophy **Quiet Complexity**: sophisticated capability that does
not demand attention until a decision, a risk, or a surprise makes attention
worth spending.

## Five principles (everything is tested against these)

### 1. Human Intention comes first

The person states what they want and why. The system proposes how. Chat may
*create* an intent, but it is never where intent *lives*. An intent is a
persistent, editable object: goal, constraints, success checks, owner,
autonomy level, and current state.

- Loom hook: Weaver already turns natural language into agents and workflows
  (`documentation/architecture/weaver-system.md`), and the task decomposer turns
  goals into task graphs (`documentation/architecture/task-system.md`).
- Design rule: no consequential run starts from a bare chat message. It starts
  from an Intent object the person can read, edit, pause, and cancel.

### 2. Human Agency is a visible dial, not a vibe

Autonomy is set per intent and per stage, on a five-step dial:
Manual → Assisted → Collaborative → Delegated → Autonomous.
Moving the dial is always an explicit human act, and moving it down takes
effect immediately.

- Loom hook: the decision layer already supports shadow mode (record only,
  never act) and per-site live bands with uncertainty thresholds
  (`documentation/reference/agent-configuration.md`, `spec.decision`), and
  learning has three autonomy modes including human-approval
  (`documentation/architecture/loom-system-architecture.md`).
- Design rule: defaults are low. The system may *propose* more autonomy with
  evidence; it may never grant itself more.

### 3. Human Understanding beats system narration

Every claim the system makes is labelled as one of four kinds:
**Observed** (the system did or saw this), **Recorded** (evidence stored,
with a link), **Inferred** (the system's best explanation — may be wrong),
**Unknown** (not yet established). Explanations are never presented as ground
truth.

- Loom hook: observability already records traces, spans, token/cost/latency,
  pattern match scores and judge verdicts
  (`documentation/architecture/observability.md`), but its own document says a
  real-time query UI is a non-goal. Understanding is the layer we must add.
- Design rule: no green tick without evidence one click away. No summary
  without its sources reachable.

### 4. Human Creativity is protected from premature automation

Automation that finishes your sentence also finishes your thinking. The
interface keeps manual and assisted work first-class: a person can always do
the task by hand, watch how the system would do it, compare, and choose.
Suggestions arrive as alternatives, not as a single take-it-or-leave-it answer.

- Design rule: for creative and judgement work, show at least two genuinely
  different options, or show one option plus "do it myself". Never silently
  collapse the option space to one.

### 5. Human Development: the tool should make the person better

If the person cannot do the task without the system after a month of use, the
design has failed even if the output is good. The interface explains *why*,
not just *what*; it lets people rehearse at lower autonomy; it keeps a visible
trail of what they decided so they can learn from their own history.

- Design rule: every automated step keeps a "show me how" view. Skill use is
  measured, not assumed (see `research/07-validation-strategy.md`).

## Quiet Complexity — what it means in practice

Minimalism here does **not** mean fewer features. It means fewer *demands*.

| Quiet Complexity rule | What it forbids |
|---|---|
| Silence is the default state | Activity feeds, agent "typing" theatre, live token streams on the home screen |
| Attention is spent, not taken | Badges, red dots, and auto-opening panels for routine events |
| Consequential things are never quiet | Approvals, irreversible actions, cost spikes, anomalies — these interrupt, clearly |
| Complexity is one layer down, not deleted | Full traces, raw logs and YAML exist — behind the object they belong to, not on the main surface |
| White space is a feature | Crowded dashboards that make everything look equally urgent |

## Anti-patterns (we will not build these)

1. **The agent parade.** A wall of live agent activity that makes the person a
   spectator of their own work. Agents are not the protagonists.
2. **Chat as the database.** Anything that matters only existing inside a
   conversation transcript. If it matters, it is an object.
3. **Confidence theatre.** Percentages and green ticks with no evidence
   behind them.
4. **Autonomy creep.** Quietly widening what the system may do without asking.
5. **Explanation as proof.** Fluent AI narration treated as verification.
   Judges score; evidence proves; narration only suggests.
6. **The hidden expert mode.** Consequential controls buried where only
   power users find them. Quiet must never mean secret.
7. **Dashboard maximalism.** Every metric on one screen. That is not
   transparency; it is outsourcing the filtering work to the person's eyes.

## The three attention states

1. **Normal operation — quiet.** The work surface shows objects and their
   state. Nothing moves unless state changed. The person works; the system
   helps in place.
2. **Decision required — clear.** One card, in context, showing: what is being
   asked, why now, the evidence, the alternatives, the consequences of each,
   and the uncertainty. In Loom, only an approval request carrying a non-empty
   `hitl_request.request_id` is answerable
   (`documentation/guides/human-in-the-loop.md`) — the interface must never
   show an answer box for keep-alive or hint messages.
3. **Unexpected behaviour — honest.** Anomalies are visible where they
   happened, with three always-available actions: inspect, interrupt, recover.
   Loom already supports durable workflow checkpoints that survive process
   exit and refuse to resume against a changed workflow definition
   (`documentation/guides/human-in-the-loop.md`) — recovery builds on that.

## What we keep from traditional tools

Files, editors, diffs, tests and terminals are proven. We do not remove them.
We demote them: they become views *inside* work objects instead of the
organising principle of the whole environment.

## The test for every future feature

Before anything ships, it must answer yes to all five:

1. Does it start from, or update, a human-stated intent?
2. Can the person see and change the autonomy level it runs at?
3. Is every claim labelled observed / recorded / inferred / unknown?
4. Could the person still do this by hand if they chose to?
5. Will the person be better at this task next month because of it?
