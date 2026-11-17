# Issue 010 — No Content-Security-Policy for the webview

- **Title:** No Content-Security-Policy for the webview
- **Severity:** P2 — security hardening

## Problem statement

`tauri.conf.json` sets `"csp": null`, so the main webview — which hosts a
same-origin Unity iframe (`spatial-player.html`), Monaco web workers, and
all bridge code — runs with no CSP. Any injection that reaches the page
(XSS, a compromised dependency in the bundle) executes with full webview
privileges, including access to the Tauri IPC surface
(`window.__TAURI_INTERNALS__`). This is defense-in-depth: no live XSS
vector was found (the code uses `textContent`/`escapeHtml` correctly), but
the CSP is the backstop that should exist for a window this privileged.

## Evidence and file references

- `src-tauri/tauri.conf.json` — `"security":{"csp":null}`.
- `index.html:81` — the Unity iframe; `src/monaco.ts` — workers;
  `src/api.ts:374-376` — Tauri detection via `__TAURI_INTERNALS__`.
- Tauri 2 default: no CSP injection when the value is `null`.

## Root cause

**Confirmed (configuration omission).** The field was never set.

## Expected behavior

A CSP that permits exactly what the app needs: bundled scripts, same-origin
frames, Monaco workers/blobs, fonts; no remote origins; no
`unsafe-inline` for scripts.

## Current behavior

No CSP; the webview trusts its own origin entirely.

## Proposed correction

- Author a policy like:
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; frame-src 'self'; connect-src 'self' ipc: http://ipc.localhost`
  (adjust for Tauri's IPC scheme on Linux/webkit), and verify:
  app boot, Unity player load, Monaco workers, and the dev proxy in
  browser preview mode (the vite preview may need its own meta tag or
  dev-only relaxation).

## Affected components

- `src-tauri/tauri.conf.json`; possibly `index.html` (dev fallback).

## Relevant Loom contracts

- None (IDE-only hardening).

## Acceptance criteria

1. The desktop app boots with CSP active and the bench loads.
2. Monaco editing works (workers allowed).
3. No new console CSP violations; the existing headless check stays clean.

## Verification strategy

- `tauri build` + runtime check of CSP violations via the headless
  Chromium pass (browser side) and a desktop smoke test.

## Dependencies

- None.

## Regression risks

- Medium — CSP mistakes break workers/wasm loading; test both dev and
  packaged paths before shipping.

---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`1c6efb8`). Webview CSP set in src-tauri/tauri.conf.json (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, …); the inline file:// guard moved into main.ts. Real-window CSP check (D14) remains environment-limited.
