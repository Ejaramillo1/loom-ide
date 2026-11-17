# QC-22 — App creation sends HTML to a declarative-spec API

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The Add app dialog submits {name, html}. CreateUIAppRequest defines name/display_name/description/spec/overwrite and no html field. The normal request is rejected by the live gateway before any app is created.

## Evidence

- [src/main.ts:3962](/home/ed/loom-ide-tauri/src/main.ts:3962) (`await createApp({ name, html })`)
- [src-tauri/src/loom_http.rs:663](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:663) (`pub async fn apps_create(`)
- [/home/ed/work/loom/proto/loom/v1/apps.proto:113](/home/ed/work/loom/proto/loom/v1/apps.proto:113) (`message CreateUIAppRequest`)
- [/home/ed/work/loom/pkg/server/apps_rpc.go:118](/home/ed/work/loom/pkg/server/apps_rpc.go:118) (`func (s *MultiAgentServer) CreateUIApp(`)

## Root cause

The UI implements a raw HTML uploader while Loom creates/compiles UI apps from UIAppSpec. The wrappers pass arbitrary JSON without validating the supported schema.

## Expected behavior

A reviewed app specification is compiled by Loom, returned with its actual metadata/content, and appears in the app list with honest errors.

## Proposed correction

Replace the HTML textarea contract with the existing UIAppSpec shape, reuse component types for schema help, and submit a typed CreateUIAppRequest. Preserve read-only list/open behavior. Do not add another HTML app service.

## Affected components

Apps creation dialog, create/update wrappers and Loom app compiler.

## Relevant Loom contracts

apps.proto::CreateUIAppRequest.spec and CreateUIAppResponse.app/content; safe live request returns HTTP 400 unknown field html. Existing update requests also require spec.

## Acceptance criteria

- Valid contained spec compiles and lists the created app.
- Unknown component/missing spec/duplicate name gives a visible error.
- Open displays actual backend output without fabricated preview content.

## Verification strategy

Protojson request fixtures plus an isolated compiler/app-provider create/list/get/update test; no real app was saved during audit.

## Dependencies

QC-01 for runtime authority and QC-02 for live deployment containment.

## Regression risks

Do not execute arbitrary HTML or overwrite an existing app unless overwrite is explicit and authorized.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (`b6c612f`). App create submits a declarative `UIAppSpec`; dialog asks for a description; component-type listing reads protojson `type`.
