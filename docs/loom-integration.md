# Loom integration boundary

Verified against the local Loom checkout at `/home/ed/work/loom`:
`proto/loom/v1/loom.proto` declares POST `/v1/weave`, a JSON `query`, optional `agent_id` and `session_id`, and a response `text`, `session_id` and `trace_id`. `pkg/server/http.go` declares GET `/health` and the streaming SSE endpoint `/v1/weave:stream`.

The Tauri adapter currently targets an unauthenticated loopback HTTP service at port 5006. The browser preview bridge supports LOOM_URL, LOOM_AGENT_ID, and optional bearer credentials in LOOM_API_TOKEN, kept server-side. The health endpoint proves service availability only, not successful authenticated execution. Streaming, tracing, session continuity and live collaboration updates are not wired into this prototype. Collaboration remains labeled demonstration even when chat health succeeds. Failed live requests produce an error instead of a fabricated response.

Live execution was not verified in this restricted build environment; opening a local network socket was denied. Both supplied reference images were inspected, but a fresh rendered comparison could not be captured: native capture requires unavailable approval and the browser host is unavailable.
