# Issue 005 — The autonomy dial does not govern Loom execution permissions

- **Title:** The autonomy dial does not govern Loom execution permissions
- **Severity:** P1 — the flagship control concept is UI-only

## Problem statement

The philosophy's core control claim — "autonomy is a visible dial…
Moving the dial… changes how much freedom the system has" — is not backed
by the backend. The dial (Manual → Assisted → Collaborative → Delegated,
per intent and per work) writes only to local JSON stores, enforces only
local ceiling rules, and transmits a single context-pack string
(`active_work_autonomy`). Loom's actual execution permissions (approval
holds, `RequireApproval`/YOLO profiles, allowed/disabled tools, shadow
mode) are entirely unaffected. The dialog copy ("gives the system more
freedom") overstates the effect. This matches the audit brief's named
critical defect: *an autonomy selector that changes the UI without
changing actual execution permissions*.

## Evidence and file references

- `src-tauri/src/lib.rs:225-273` (`set_work_autonomy`): all logic is local
  (`WorkStore`); no Loom call.
- `src-tauri/src/lib.rs:355-410` (`update_intent`): local cascade only.
- `src/api.ts` / `src-tauri/src/store.rs`: persistence is `work.json`/
  `intents.json`.
- Transmission: `src/main.ts:4873` puts `active_work_autonomy` into the
  chat context pack — a `map<string,string>` for prompt interpolation
  (`loom.proto:764`), with **no verified effect** on any permission
  system.
- UI copy: `src/main.ts:956` "gives the system more freedom."
- Loom's real control surfaces (unused by the dial): `shuttle.PermissionChecker`
  (RequireApproval/YOLO/AllowedTools/DisabledTools), admission chain,
  approval holds keyed by `hitl_request.request_id` (the chat HITL cards
  *are* wired — but they fire from server policy, not from the dial).
- Old audit (`docs/LOOM_CONNECTION_AUDIT.md`): "Planning mode / autonomy…
  Does not enforce agent permissions, budgets or tool access."

## Root cause

**Confirmed (design gap, not a typo).** Loom has no per-intent autonomy
object; the mapping from the philosophy's five levels to Loom's
permission machinery was never built. The dial was implemented as local
planning policy while its copy kept the philosophy's execution-governing
language.

## Expected behavior

A change in autonomy is observable in Loom's actual approval behavior:
Manual/Assisted turns require approval for consequential tools;
Collaborative approves with judgment points; Delegated/Autonomous runs
under explicitly bounded server-side profiles — and lowering the dial
takes effect immediately (philosophy movement rule 1).

## Current behavior

The dial changes local state, the history trail, and one context string.
Loom approves or holds tools according to its own agent/server config
only. The user believes they are granting/withholding freedom; the system
grants or withholds nothing in response.

## Proposed correction

Two stages (roadmap Phase 3):

1. **Truth first (IDE-only, immediate):** change the dialog copy to state
   that the dial currently governs local planning policy and what is sent
   to Loom, until the execution mapping ships. Never claim backend
   enforcement that does not exist.
2. **Mapping (IDE + optional Loom):** define a per-level tool-approval
   profile; transmit it per turn (e.g. via `WeaveRequest.backend_config`
   or a session metadata convention), and mirror the level in the HITL
   card's framing. If Loom-side support is needed (permission profiles per
   request), scope it as a small Loom feature behind Eduardo's decision.

## Affected components

- `src/main.ts` (dial, justification dialog, context pack)
- `src-tauri/src/lib.rs` / `store.rs` (unchanged local model)
- Possibly Loom `permission`/`admission` surfaces (decision-gated)

## Relevant Loom contracts

- `WeaveRequest.backend_config` / `context` (loom.proto:755,764)
- `HITLRequestInfo` + `AnswerClarificationQuestion` (already wired)
- `pkg/shuttle/admission_chain.go`, `permission.Service`

## Acceptance criteria

1. Copy accuracy: the UI never claims execution control it does not have.
2. In a live hold test: setting the dial to Manual causes an approval hold
   for a consequential tool that Delegated would auto-run (per the agreed
   mapping), and lowering the dial mid-plan affects the next turn.
3. The mapping is documented in DECISIONS.md with per-level behavior.

## Verification strategy

- Live hold test with a consequential tool (shell/file write) at two dial
  levels; unit tests for the transmitted profile fields.

## Dependencies

- Issue 003/004 are unrelated; this depends on the agreed
  level→profile mapping (design task) and possibly a Loom permission
  extension.

## Regression risks

- Medium: the chat HITL flow already works — any permission transmission
  must not regress the existing hold/answer path (regression: existing
  HITL card tests + live hold test).

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** STILL OPEN (by design). Re-verified at Loom `8082078`: no autonomy enforcement exists in the weave path. IDE honesty is fixed (`a02ad52`): the dial states its local-only scope (main.ts:950) and boundary tests pin ceiling/justification rules. Enforcement needs a Loom-side contract — maps to QC-01.
