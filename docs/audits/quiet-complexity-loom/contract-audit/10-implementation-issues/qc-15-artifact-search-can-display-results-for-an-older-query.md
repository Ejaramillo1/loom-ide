# QC-15 — Artifact search can display results for an older query

Severity: **P2**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

Two debounced artifact searches can overlap. If the older query returns last, searchArtifactsView replaces the current results with the older result set even though the search input still shows the newer query.

## Evidence

- [src/main.ts:4595](/home/ed/loom-ide-tauri/src/main.ts:4595) (`searchArtifactsView`)
- [Executed reversed-order handler probe](../evidence/frontend-contract-probe.log)

## Root cause

The asynchronous search handler has no generation counter or query identity check; global list refreshes can race the same state.

## Expected behavior

Visible artifact rows correspond to the current query and tab; stale requests do not overwrite newer results.

## Proposed correction

Use one request generation counter shared by search and list refresh. Apply rows/errors only when the response still owns the current query/tab. Follow the existing documentRequest pattern used by file opening.

## Affected components

Artifact search, global artifact list refresh and tab changes.

## Relevant Loom contracts

SearchArtifactsRequest.query and SearchArtifactsResponse.artifacts. This is a frontend sequencing defect; server artifact content/search wrappers and View actions DO exist.

## Acceptance criteria

- Resolve query B before older query A: B remains visible.
- Clearing the query or changing tabs invalidates pending search responses.
- Only the current request can publish an error.

## Verification strategy

The committed extracted-handler probe reproduces an older response overwriting the newer one. Add a production-handler regression for reversed completion order and search-clear/tab-change races.

## Dependencies

None.

## Regression risks

Preserve the previous visible rows on a current-request failure and retain the real server content preview.
