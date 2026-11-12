# 02 — Design Research

*What minimalist design and human–AI research actually teach us — with
established findings kept separate from our own speculation.*

## How to read this document

- **Established** = a widely replicated finding or a canonical designer's
  stated principle. Safe to build on.
- **Transfer** = our judgement about how that principle applies to an
  AI-native work surface. Defensible, but not proven here.
- **Speculative** = a hypothesis this project should test, not assume.
  Each one is picked up again in `research/07-validation-strategy.md`.

No runtime behaviour of Loom was tested for this document. Loom claims are
limited to what its own documentation states (see
`research/05-loom-assessment.md`).

## Part 1 — The minimalist designers

Minimalism in these designers is never "less stuff". It is the removal of
everything that does not serve the person's purpose, so that what remains can
be understood at a glance.

| Designer | Core idea (established) | Transfer to Loom's front end |
|---|---|---|
| Dieter Rams | "Less, but better." Good design is understandable, honest, unobtrusive, and thorough down to the last detail. | The home surface shows work objects and their state — nothing else. Honesty rule: a status is only shown if evidence backs it. |
| John Pawson | Emptiness gives objects presence; light and proportion do the work decoration usually does. | Silence as the default state. Motion and colour are reserved for state change, decisions, and anomalies. |
| Naoto Fukasawa | "Without thought" — design that fits behaviour people already have, found rather than invented. | Start from how people already investigate, review, and decide (diffs, tests, checklists). Do not invent a new ritual where an old one works. |
| Kenya Hara | Emptiness (kū) as an invitation: a surface that is open invites the person to complete it with their own intent. | The Intent object starts almost empty — a goal in the person's own words — and gains structure only as needed. The system never fills silence with guesses presented as fact. |
| Tadao Ando | Restraint and light reveal structure; a few materials, used exactly. | One type scale, one accent colour for "needs you", one for "failed". Structure (Intent → Work → Artifact) is visible instead of decorated over. |
| Agnes Martin | Quiet repetition and grids; calm is a discipline, not an accident. | Lists of work objects share one rhythm: name, state, evidence, autonomy. Predictable layout lowers the effort of scanning. |
| Donald Judd | "Specific objects": things should be what they are, in real space, without illusion. | No fake depth, no agent avatars pretending to be colleagues. An approval is a card, a trace is a trace. Objects are named by what they are. |
| John Maeda | The Laws of Simplicity: organise, reduce thoughtfully, failure is expected, "simplicity is about subtracting the obvious and adding the meaningful." | Subtract: live activity theatre. Add the meaningful: why this needs you, what happens if you say no. Design explicitly for failure states (Maeda's Law 9). |
| Massimo Vignelli | A strict grid and a tiny type palette make complex information legible; "if you can design one thing, you can design everything" through system, not styling. | One object grammar everywhere: every object — intent, task, artifact, approval — shows state, evidence, and control in the same positions. |
| Josef Müller-Brockmann | Grid systems create order the reader can learn once and trust. | The three attention states (quiet / decision / anomaly) use fixed positions. A decision card always looks like a decision card, wherever it appears. |
| Mies van der Rohe | "Less is more"; structure expressed honestly. | The autonomy dial is structural, always visible on an intent — never a setting buried in preferences. |
| Kazuyo Sejima / SANAA | Transparency and lightness; boundaries that let activity be seen without being staged. | The system boundary is visible: what is local, what is sent to a model, what needs permission. Seen, but not dramatised. |
| Jony Ive | Simplicity is the outcome of deeply understanding complexity, not ignoring it; care is shown in details nobody is forced to notice. | The complexity of Loom (judges, patterns, memory layers) stays available one layer down. Care = correct small behaviours: no answer box without a request id, no "done" without evidence. |
| Luis Barragán | Colour and light used sparingly, for emotional orientation; serenity as a functional quality. | Colour means one thing each: needs-you, failed, done-with-evidence. Everything else is neutral. Calm is treated as a usability requirement, not a style. |

### The synthesis: Quiet Complexity

From the table, four transferable rules:

1. **Remove demands, not capability.** Every designer above removes what
   competes for attention, never what serves the purpose. (Established as
   design practice; Transfer to AI surfaces.)
2. **One grammar, everywhere.** Vignelli and Müller-Brockmann: a learnable
   system beats local cleverness. (Established; Transfer.)
3. **Emptiness invites intent.** Hara and Fukasawa: the surface should make
   room for the person's purpose instead of filling it with system content.
   (Transfer.)
4. **Calm is functional.** Barragán and Pawson treat serenity as something
   the user *uses*. For an AI surface, calm is what makes an interruption
   meaningful. (Transfer; testable — see H4 in the validation strategy.)

## Part 2 — What HCI research establishes

These are established findings from human–computer interaction and
human–automation research. Author names are given so they can be checked;
this project did not re-run any of these studies.

1. **Levels of automation are a design choice with trade-offs** (Parasuraman,
   Sheridan & Wickens). More automation reduces workload in routine moments
   and increases it during failures, because the human must suddenly rebuild
   understanding. → Our five-step autonomy dial, per intent and per stage.
2. **Trust must be calibrated, not maximised** (Lee & See, 2004).
   Over-trust causes misuse; under-trust causes disuse. The remedy is showing
   capability, uncertainty, and past performance — not persuasion.
   → Evidence and uncertainty sit next to every consequential claim.
3. **Situation awareness decays out of the loop** (Endsley). A person who
   only approves outcomes loses the mental model needed to catch errors.
   → "Show me how" views and inspectable intermediate work are mandatory,
   not expert extras.
4. **Cognitive load is finite; extraneous load is the enemy** (Sweller).
   Split attention and decorative complexity consume the budget needed for
   the actual task. → Quiet default state; one object grammar.
5. **Recognition beats recall** (Nielsen's heuristics). People should not
   have to remember what an agent said three screens ago. → Persistent work
   objects instead of chat transcripts as the record.
6. **Direct manipulation builds agency** (Shneiderman): visible objects,
   rapid reversible actions, incremental effects. His later human-centered
   AI work adds: high automation *and* high human control are achievable
   together — they are not opposites. → Drag, reorder, edit, undo on work
   objects; the autonomy dial moves both ways instantly.
7. **AI interaction guidelines** (Amershi et al., Microsoft, 2019): make
   clear what the system can do, show contextually relevant information,
   support efficient correction, and learn from user behaviour cautiously.
   → Correction is a first-class action on every inferred claim.
8. **Mixed-initiative interaction** (Horvitz): the system should act on its
   own only when the expected benefit outweighs the cost of interrupting or
   being wrong, and uncertainty should govern that choice. → This is the
   theoretical basis for Loom's decision-layer thresholds — and for showing
   them to the person instead of hiding them.
9. **Automation bias and deskilling** (aviation and medical literature):
   people defer to automated suggestions even against their own correct
   judgement, and unpractised skill fades. → Show alternatives, keep manual
   paths real, and measure skill, not just output (RQ8).

## Part 3 — Speculative ideas (ours to test, not findings)

| # | Speculation | Why it might be wrong |
|---|---|---|
| S1 | An Intent object is a better unit of interaction than a chat thread. | For quick questions, chat may simply be faster; intent objects could become paperwork. |
| S2 | Labelling claims observed / recorded / inferred / unknown improves calibration. | Labels could become wallpaper people stop reading. |
| S3 | A visible autonomy dial increases felt agency without reducing throughput. | People may set it once and never touch it, making it decoration. |
| S4 | Quiet defaults increase the speed and quality of decisions when interruptions come. | Quiet could also hide slow drift (cost, stale context) until it is expensive. |
| S5 | Persistent work objects reduce "where was I?" time after interruptions. | Objects could fragment attention if every task spawns several. |
| S6 | Seeing how the system did something preserves the person's own skill. | Watching is not doing; skill may still fade. |

Each speculation maps to a testable hypothesis in
`research/07-validation-strategy.md`.

## What this means for the design, in one paragraph

Research does not support "show the user everything the agents are doing"
(transparency as volume) and does not support "hide the AI behind one magic
button" (simplicity as concealment). It supports a middle position that is
harder to build: a small number of persistent, honestly-labelled objects;
automation whose level the person sets and can feel; evidence that is one
step away rather than on display; and interruptions that are rare enough to
mean something. That is Quiet Complexity, and it is the standard the concepts
in `research/04-ux-concepts.md` are judged against.
