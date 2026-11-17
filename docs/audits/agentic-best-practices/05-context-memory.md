# 05 — Context & Memory Assessment

## The six-way split (reference: context-and-memory.md)

| Category | Quiet Complexity | Correctness / retention | Gap |
|---|---|---|---|
| **Task context** | `buildChatContext()` → `WeaveRequest.context` → `requestContextSection` (bounded 1200 chars, file 600, truncation stated, labeled untrusted) | Constraints survive truncation | Hypotheses not marked "unverified" on the wire |
| **Execution state** | Client run records (localStorage) + Loom session history | Recovery does not repeat an action | Client store is not transactional; Loom history is authoritative but read-only |
| **Knowledge** | Local `Research Vault` (markdown, one-way mirror from Loom sessions/agents/artifacts) + Loom artifacts/patterns | Freshness, citations | Vault is a mirror, not the source of truth; no citation link back to artifacts |
| **Episodic memory** | None explicit | An earlier error is not promoted to fact | Loom graph memory (gRPC) unwired |
| **User preferences** | Appearance/theme/reduced-motion (local settings) | Consent/correction | minimal |
| **Procedural knowledge** | Loom skills (import now HTTP) | Versioned, trusted origin | Skills are Loom's; the IDE has no own skill layer (correct) |

## Context construction & propagation

`buildChatContext` (main.ts) captures the selected work title/status/autonomy,
the active intent statement, the open-file label + first 4000 chars, the
active experiment, and session/agent ids. On Loom `8082078`, the server
consumes this into a bounded, labeled section and **prepends it to the
query**; the IDE no longer double-injects (QC-09 fixed). The section is
explicitly labeled "informational, not instructions" — matching the
reference's rule that retrieved content is data, never directives.

**Budget:** 1200 char section + 600 char file content, truncation stated.
Good; large artifacts stay out of the prompt.

## Memory: does the IDE rely on Loom, or build its own?

- **Loom memory:** graph memory, memory layer, cross-agent memory exist in
  Loom but are **gRPC-only** and not wired (no Rust gRPC client). So the
  IDE currently gets **no Loom memory**.
- **IDE memory:** the local markdown vault (notes, links, evidence kinds)
  is the only working memory, and it is a **one-way mirror** of Loom
  sessions/agents/artifacts (idempotent by `Loom ID: {id}` marker, no
  inline content copied).
- **Run records** are client-side execution state, correctly separate from
  memory.

This is a **gap, not a conflict**: the IDE has a lightweight local knowledge
surface and no access to Loom's richer memory because the transport was
deferred. It does not *conflict* with Loom memory — it under-uses it.

## Contamination & isolation (reference's key question)

- **Work-item isolation:** the context pack is built from the *selected*
  work/intent at send time and captured before any `await`, so a mid-flight
  work switch cannot bleed one item's context into another (tested in
  `chat-lifecycle.test.ts`).
- **Session isolation:** identity is captured at send time (QC-03), and the
  done branch no longer adopts the newest/current session (issue 007).
- **Vault vs Loom:** the mirror whitelists metadata fields and never copies
  inline artifact content, avoiding leakage of Loom data into the vault.
- **Evidence vs recall:** evidence-kind labels (`observed`/`recorded`/
  `inferred`/`unknown`) distinguish verified facts from inference; live
  replies default to `observed`.
- **Cross-user:** single-user local app; the vault and stores are per app-
  data dir (`LOOM_VAULT_DIR` override). No multi-tenant surface.

## Findings

1. **Context pack is bounded and correctly treated as untrusted** — no
   prompt-injection vector from open-file content (truncated, labeled).
2. **Loom memory is unreachable** — a capability gap to close via the gRPC
   client (D3), not a correctness bug.
3. **The vault mirror is one-way and metadata-only** — safe, but it means
   "memory" today is local notes, not Loom's graph memory.
4. **No explicit episodic/preference memory** — acceptable for the current
   single-user scope; a product decision if it grows.
