# Backlog (registered, not forgotten)

The build plan §14.5 marks these as backlog: each waits for a named use
case. Nothing here is scheduled; nothing here is silently dropped.

| Surface | RPCs | Status |
| --- | --- | --- |
| Tri-modal communication: bus pub/sub | 5 | gRPC-only · backlog |
| Tri-modal communication: unicast | 2 | gRPC-only · backlog |
| Tri-modal communication: shared memory | 6 | gRPC-only · backlog |
| Lua scripts | 4 (HTTP) | backlog — no Lua surface until a use case names itself |
| Teleprompter | 4 | gRPC-only · backlog |
| Learning agent | 7 | gRPC-only · backlog |
| LLM scheduler | 3 | gRPC-only · backlog |
| Memory layer / ROM / learned layer | 5 | gRPC-only · backlog |
| Graph memory viewer/writes | 15 | gRPC-only · backlog (transport decided: Rust gRPC client) |
| Judge scoring in Experiments | 4 | gRPC-only · backlog (transport decided: Rust gRPC client) |
| Tool registry beyond register/list | 5 | gRPC-only · backlog (transport decided: Rust gRPC client) |
| Loom-as-MCP-server ↔ MuseBridge harness | — | backlog — connect decided, both directions |
| xterm.js terminal · file explorer · memory backend (Cognee/Mem0/Graphiti) · E2B · Opik · LiteLLM | — | one decision per dependency (Monaco, promptfoo and Docling are decided) |

## Real-window verification (D14)

Editor captures exist (`docs/bench-shots/`); the real Tauri window has
never been screenshot — visual feedback is permission-blocked on this
machine. Everything pixel-level above the Editor awaits that.
