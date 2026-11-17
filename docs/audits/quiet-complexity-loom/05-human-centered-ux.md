# 05 — Human-Centered UX Audit

Alignment of the implementation with the Quiet Complexity philosophy
(`docs/01-design-philosophy.md`, source of record incl. the Spanish
reconstruction) and the interaction model (`docs/03-interaction-model.md`).

## 1. The five foundational concepts — verified representation

| Concept | In the data model | In behavior | Verdict |
|---|---|---|---|
| **Intent** | `IntentStore`: statement, why, acceptance criteria, autonomy, versions, history | Header banner shows the active intent; no work without an intent (auto-created one-liner); intents are editable/persistent objects | ✅ genuinely represented, **local-only** (Loom has no intent object; a Weaver request / task-board goal is the nearest counterpart) |
| **Work** | `WorkStore` items owned by intents, status, success criteria, session link, artifact links | Work↔session binding to real Loom sessions; chat scoped per work; artifacts scoped per session | ✅ represented; server-side counterpart (tasks) is **broken** (issue 001) |
| **Artifacts** | Real Loom artifacts, session-scoped lists, attach/detach, content view with base64 decode | Live-verified: 2 artifacts, content readable | ✅ fully real |
| **Evidence** | `EvidenceKind` labels (observed/recorded/inferred/unknown); experiment decisions = recorded, workflow outputs = observed | Labels rendered on every evidence row; empty states explain the next step | ⚠ labels are honest but the **chain** is missing: no trace links (issue 004), no source-open for executions; work attribution volatile (issue 006) |
| **Control** | Autonomy dial (4 levels + history + justification), Stop for streams, Dismiss for workflow tracking, approve/deny HITL cards, session delete/resume | Moving down instant; moving up requires justification; cascade tightens work on intent change; Stop cancels streams (~20 s); HITL cards keyed to real request ids | ⚠ the dial governs **local policy only** — Loom's execution permissions are untouched (issue 005). Stop/HITL are real. |

## 2. The six audit questions, answered

**Can a user move from an intention to actual Loom execution?**
Yes — partially. Stating an intent → creating work → chat runs through real
Loom execution (live-verified). But no *consequential* run is gated on the
intent's acceptance criteria or autonomy level: chat executes regardless of
the dial's position.

**Can execution results be traced back to the original intention?**
Weakly. Work↔session↔artifacts is durable (work.json + server session);
workflow executions are attributed through in-memory maps that die on
restart, and the streamed path can attribute to the wrong work item
(issue 006).

**Can artifacts be connected to the work that produced them?**
Yes — session-scoped artifact lists per work (live-verified) plus manual
attach/detach.

**Can the human inspect evidence supporting an agent's conclusions?**
Partially. Evidence rows carry provenance kinds, and chat replies are
labeled "Live — answered by the Loom server". But: no trace view is
reachable (issue 004), workflow outputs are truncated prose (400 chars)
with no open-source path, and chat replies carry no evidence-kind label
(issue 008).

**Can the user interrupt an authorized operation?**
Yes for chat streams (Stop → cancel flag; live-cancel within ~20 s of
silence) — **with a confirmed exception**: if the terminal event is
dropped by the registration race (issue 016), the Stop button never
appears and the chat stays busy with an empty bubble; Stop also reports
an unknown request id because the cancel entry is already gone. Until
016 is fixed, interruption is reliable only when the turn is registered
before events arrive. Workflows: no — the server offers no cancel for
plain runs and the IDE says so ("Dismiss" is honest). Schedule executions
*have* a server cancel, but the IDE never surfaces it (issue 012).

**Does the interface distinguish verified facts from generated explanations?**
In Evidence: yes (kind labels). In chat: no — every reply looks identical
regardless of provenance; the `evidenceKind` render path exists but the
backend never sends it (issue 008).

## 3. Autonomy — the critical control question

**An autonomy selector that changes the UI without changing actual
execution permissions is a critical integration defect.** This is the state
today, with one mitigation: the code is honest about the ceiling rules it
*does* enforce (local), and the docs say the dial is local. But the UI copy
("gives the system more freedom") overstates. Loom's real permission
surfaces — approval holds (already wired for chat!), `RequireApproval`
profiles, allowed/disabled tool lists, shadow mode — are the correct
mapping targets, and none of them is driven by the dial (issue 005).

The philosophy's movement rules that ARE implemented (and should be kept):
instant downward movement, justification-gated upward movement, cascade
tightening, recorded history.

**Priority note (2026-11-15):** this defect, together with the exposed
unauthenticated gateway (QC-02), is a **P0 control-boundary risk** and is
sequenced in Phase 2 of `09-remediation-roadmap.md` — ahead of cosmetic
and admin expansion. The dial's copy must state exactly what it governs
until a real permission mapping exists; it must not imply server-side
enforcement.

## 4. Attention states

| State | Implementation | Verdict |
|---|---|---|
| Quiet | No activity feed; working indicators only on the object being worked on; sphere states from real events | ✅ true to the philosophy |
| Decision required | One card (experiment decision dialog) with question, hypothesis, arm results, choose/change actions; HITL cards in chat with approve/deny/answer | ✅ real decisions; Loom-side HITL *inbox* does not exist server-side (no list endpoint) — the local inbox is the honest substitute |
| Unexpected behaviour | Errors inline where they happened; sphere error state; three actions (inspect/interrupt/recover) — inspect/recover are partial (no trace chain) | ⚠ partial |

Keep-alive and pre-creation HITL pings are correctly suppressed
(`main.ts:5061` — only non-empty `request_id` raises a card), matching the
proto's own warning. This is a real, non-trivial correctness win.

## 5. Design-quality review

| Dimension | Evidence | Verdict |
|---|---|---|
| Calm, minimalist composition | Single bench view, conversation left / Unity center / knowledge right; drawers below 1100 px; one contextual surface at a time (drawers never stack) | ✅ |
| Design tokens | `design-tokens.json`: 6 radii + dark/white palettes incl. orb tokens; contrast fix recorded (`#645D57` replaces `#77716D`) | ✅ |
| Typography | Inter + JetBrains Mono (fontsource) | ✅ |
| Empty states | One-line "what is missing + next step, naming an existing control" pattern (D9) — verified across agents/evidence/artifacts/workflows | ✅ |
| Provenance labels | Evidence kinds rendered as badges with explanatory tooltips | ✅ (surface exists; chat feed gap — issue 008) |
| Honest labels | "Live — answered by the Loom server"; offline wording unified ("The Loom server is offline."); "Showing 500 — may be more" caps; Dismiss tooltip ("server-side execution continues") | ✅ exemplary |
| Keyboard | Focus traps for drawers/dialogs, Escape handling, arrow-key canvas movement, Enter/Space on graph nodes, `aria-*` throughout | ✅ |
| Reduced motion | `prefers-reduced-motion` stops dust motes, portal orbit; bench reads it on load and change | ✅ |
| Progressive disclosure | Traces/raw config one layer down (inspector, dialogs); complexity behind objects, not on the surface | ✅ |
| Sphere discipline | "Not a mascot"; states derive from real state; error/attention/executing semantics documented | ✅ (caption wording issue 014) |
| Performance | Monaco bundle 4.16 MB raw / 1.07 MB gzip; wasm 25.5 MB; DPR cap 2×; quality tiers; watcher polls 3 s signature | ⚠ acceptable, monitored; see 07 |
| No-framework constraint | Vanilla TS respected; no React introduced | ✅ |

## 6. Where polish outruns function (do not confuse the two)

- The **kanban** looks like a finished planning surface; every button 404s
  (issue 001). This is the single worst violation of "complexity is one
  layer down, not deleted" — the complexity is *displayed* but not
  *connected*.
- The **Skills shelf** copy is honest about the missing list endpoint, but
  the add/classify/import forms still invite actions that cannot succeed
  (issue 002).
- The **A/B dialog** renders modes and provider checkboxes; on this server
  the provider list is empty and the stream framing would hide all results
  (issue 003).
- The **trace button** and **evidence-kind labels** are rendered-nowhere
  features: the UI supports them, the backend cannot supply them (issues
  004, 008).

## 7. What must NOT be simplified away

Per the philosophy (§ "We keep from traditional tools" and §11 anti-pattern
4): do not respond to this audit by deleting the kanban, skills, A/B, or
trace surfaces. Each maps to a real Loom capability (gRPC-side or
HTTP-side). The correct action is to **connect them** (register the gateway
services or gate the surfaces on a real probe) — not to strip them for
visual calm. Organize the complexity; do not delete it.

## 8. Human-centered verdict

The philosophy is authentically encoded in the product's data model and in
its honesty mechanics. The remaining gaps are *integration* gaps, not
philosophy gaps: control is local-only, evidence chains are severed, and
three visible surfaces invite actions the backend cannot serve. Two
primary-path defects also break the human's basic expectations — a chat
that can strand busy with no Stop (issue 016) and large events corrupted
by undecoded chunk framing (issue 017). Fixing the P0/P1 integration
issues (QC-01/02, 001–005, 008, 016, 017) is what would make Quiet
Complexity "a genuine human-centered interface to Loom's actual
intelligence" rather than an honest-but-partial one.
