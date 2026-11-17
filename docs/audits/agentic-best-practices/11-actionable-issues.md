# 11 — Actionable Issues

One self-contained issue per verified problem, in `11-issues/`. Each is
independently understandable and suitable for later review. Priority order
matches `10-remediation-roadmap.md`.

| ID | Severity | Title | File |
|---|---|---|---|
| AP-01 | P0 | Autonomy dial is not enforced by the execution path | `11-issues/issue-ap-01-autonomy-not-enforced.md` |
| AP-02 | P0 | Local gateway exceeds the documented localhost trust boundary | `11-issues/issue-ap-02-gateway-exposure.md` |
| AP-03 | P1 | gRPC-only Loom capabilities are unreachable from the IDE | `11-issues/issue-ap-03-grpc-families-unwired.md` |
| AP-04 | P1 | Local work/intent/vault storage duplicates Loom tasks/artifacts/memory | `11-issues/issue-ap-04-storage-duplication.md` |
| AP-05 | P1 | No held-out evaluation set; "completed" is not "correct" | `11-issues/issue-ap-05-evaluation-gap.md` |
| AP-06 | P1 | `max_rounds` is sent but has no server consumer (budget not enforced) | `11-issues/issue-ap-06-max-rounds-unenforced.md` |
| AP-07 | P2 | No live UI→Loom→UI turn through the rebuilt binary at head | `11-issues/issue-ap-07-traversed-path-unproven.md` |
| AP-08 | P2 | HITL approval→tool-execution binding is source-confirmed, not live-verified | `11-issues/issue-ap-08-approval-binding-unverified.md` |
| AP-09 | P2 | MCP spec version unpinned; Loom-as-MCP (D5) not implemented | `11-issues/issue-ap-09-mcp-version-and-d5.md` |
| AP-10 | P3 | Engineering hygiene: native-app fmt debt, dial/level drift, reserved attention kind | `11-issues/issue-ap-10-hygiene.md` |
