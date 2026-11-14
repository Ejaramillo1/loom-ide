# Fold progress

- Start: baseline 1f20256 on tauri-prototype; tracked tree clean, only supplied prompt/inventory untracked. Phase 0 mapping verified against source; builds not yet run. Next: safe markdown adapter.
- Phase 0 committed: `5eedfb9`, mapping covers B1–24, D1–10 and E1–11. Source mismatch (9 relations) and deletion prohibition recorded. Next: adapter verification.
- Phase 1: new adapter tests passed; full suite passed with local socket permissions (89 passed, 1 ignored). Real-vault read-only smoke: 0 visible notes, 0 visible edges, 0 pending; historical files retained. Plain sandbox had 2 navigation socket-permission failures, resolved by the authorized local rerun. Next: Knowledge UI. Phase 1 SHA recorded in the next entry.
- Phase 1 committed: `b1953fc`; 89 passed / 1 ignored, Tauri fmt clean. Adapter is one module; API bridges added with Phase 2.
- Phase 2: Knowledge nav and five subviews implemented, shared search input plus Ctrl+K/N, proposal bell, note editor/provenance/history/links/review, session canvas and export. `npm test -- --run`: 48/48 passed; `npm run build`: passed. Real/empty vault checks are adapter tests (real vault has hidden fixtures only); preview honestly requires desktop IPC. Next: consolidation/state bridge. Phase 2 SHA follows in next entry.
