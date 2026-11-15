# 05 — Human-centered UX audit

The specification is `docs/01-design-philosophy.md`, interpreted with `docs/DECISIONS.md`, the Unity-first audit and later design/fold progress. Historical screenshots and the old README are not the current product specification. Assessment below separates source behavior from rendering that was not observed.

| Human concept | Real implementation | Gap and consequence | Smallest correction |
|---|---|---|---|
| Intent | Persistent editable statement, why, acceptance criteria, versions and autonomy history | Chat can start without an intent; context does not reach runtime as claimed. A consequential run need not be attached to the objective. | Keep free manual work; require/record originating intent for consequential runs and prove transmitted context, QC-01/09/14. |
| Work | Local catalogue, active/paused status, criteria, session and artifact IDs | Pause is local planning. Execution ownership can move with selection or disappear on restart. | Preserve local work and add authoritative, durable run relations, QC-13/14. |
| Artifacts | Real server list, View content, server search and local attachments; local documents also exist | Results can be associated weakly; search responses can race. Binary/read errors need live inspection. | Existing View/search surfaces suffice; fix ordering and durable producer links, QC-14/15. |
| Evidence | Observed workflow output, recorded experiment decisions, local review edges and traces by ID | Generated arm prose is not controlled experiment evidence; cache loses trace handles; stream replies lack authoritative IDs. | Label generated conclusions inferred/unknown and keep actual test/tool/trace evidence one click away, QC-14. |
| Control | Dial/history, Stop, legacy question cards, parked approval cards, agent lifecycle, schedule controls | Dial does not enforce runtime policy; stored approval answers go to legacy map; Stop currently signals socket cancellation, not a demonstrated stopped tool. | Fix server authority and acknowledgement first, QC-01/04/06/07. |

The shipped dial has four levels. The philosophy describes five including Autonomous, but the recorded implementation is four; this audit does not add a level or silently reinterpret its privileges. Defaults are Collaborative, which is a local planning default and should not be presented as a verified runtime grant. The smallest honest interim UI explicitly says advisory while runtime enforcement is repaired; that interim label alone does not meet full integration.

Manual work is real: files, explicit save, local notes, graph/canvas editing and planning do not require AI. This is an important strength. Do not remove it or replace the workbench with an agent-monitoring dashboard.

## Calmness, predictability and disclosure

Source shows a thin shell, shared conversation/context pane, reusable knowledge editing, one Graph/Canvas pane, drawers with Escape/focus handling, scoped searches, honest no-data states, and details/dialogs for lower-level controls. The avatar remains decorative. Three searches and two experiment meanings are recorded decisions; they are not audit reasons to delete functionality. The sphere stays as a connection/state surface. Additional primitives should appear under the work that owns them, not as another permanent status wall.

Attention is currently a combination of local experiment decisions and note proposals, not a complete remote pending-decision inbox. A routine event should not demand attention, but approvals must show exact consequences, alternatives, evidence, uncertainty and expiry. Current approval cards expose only a small subset of `HITLRequestInfo` and ignore detailed context_json/items; QC-07 requires preserving the actual decision context.

## Tokens, themes, accessibility and motion

`design-tokens.json` feeds CSS variables through theme.ts and Monaco themes; Unity has mirrored palette/state rules and receives theme messages. Source avoids rendering agent text as arbitrary HTML in the inspected response/artifact paths. The contrast refinement overrides muted light-theme text; actual contrast across every state was not measured in this audit.

Keyboard/focus/drawer tests pass. CSS and the player follow prefers-reduced-motion, and Unity can pause ambient movement. The HTML navigation offers an alternative to pointer-only spatial selection. That does not prove canvas/IMGUI accessibility or every dynamically created dialog's focus lifecycle. Screen-reader behavior, zoom, narrow viewports, light/dark pixel fidelity and real WebView rendering remain NOT VERIFIED because the browser inspection timed out and native CUA surfaces were unavailable.

Motion and graphics must remain subordinate to editor responsiveness. Continuous hidden Unity rendering is a performance question to measure, not evidence of real backend execution. A blue/green sphere is only as truthful as the event/state input: QC-04 must be fixed before it can reliably imply completion.

## Acceptance for the human workflow

State an objective; choose its enforced scope; start a bounded run; inspect actual tool/evaluation evidence; answer/deny a server hold; interrupt and observe acknowledged state; open its artifact; restart and recover the same relationships. Also perform the task manually/offline. This is the product test, beyond a collection of reachable API buttons.
