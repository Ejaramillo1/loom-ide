# QC-10 — Task and skill annotations are not registered HTTP services

Severity: **P1**. Confidence: **Confirmed**. Audit baseline: IDE `c46aa644`, Loom `ab46f76f`, 15 November 2026.

## Problem and current behavior

The IDE calls /v1/boards, /v1/tasks and /v1/skills. The local Loom HTTP Start registers only LoomService; TaskService and SkillsImportService are peer services, despite their HTTP annotations.

## Evidence

- [src-tauri/src/loom_tasks.rs:41](/home/ed/loom-ide-tauri/src-tauri/src/loom_tasks.rs:41) (`pub async fn task_boards_list(`)
- [src-tauri/src/loom_http.rs:589](/home/ed/loom-ide-tauri/src-tauri/src/loom_http.rs:589) (`pub async fn skills_add(`)
- [loom/pkg/server/http.go:113](/home/ed/work/loom/pkg/server/http.go:113) (`loomv1.RegisterLoomServiceHandlerFromEndpoint`)
- [loom/proto/loom/v1/skills_import.proto:35](/home/ed/work/loom/proto/loom/v1/skills_import.proto:35) (`service SkillsImportService`)
- [loom/proto/loom/v1/task.proto:22](/home/ed/work/loom/proto/loom/v1/task.proto:22) (`service TaskService`)

## Root cause

Schema-level HTTP bindings were taken as proof of running gateway registration. Safe live board/task probes return 404.

## Expected behavior

Supported configured services are registered and feature availability is based on real service capabilities.

## Proposed correction

Register the existing generated TaskService/SkillsImportService gateway handlers in Loom when those services are available, or use the explicitly chosen transport. Gate UI availability honestly until then; do not invent new task or skill infrastructure.

## Affected components

Loom HTTP gateway bootstrap; IDE task board and skills surfaces.

## Relevant Loom contracts

task.proto and skills_import.proto; their server implementations exist. The running gateway binary version is 1.4.0; its exact source commit was not established.

## Acceptance criteria

- Configured board/task and skills validation routes no longer return unimplemented-route 404.
- Unavailable services show a service-specific state instead of generic Loom offline.
- No silent migration of local work occurs.

## Verification strategy

Isolated gateway service-registration tests plus read/create/update/restart round trips against a contained store.

## Dependencies

Loom-side change authorization/transport decision; QC-11 before task mutation tests.

## Regression risks

Keep local work data independent; adding service reachability does not prove its caller schemas.


---

**Current status (2026-11-16, IDE @ `f75ad9f`, Loom @ `8082078`):** FIXED (server-side, Loom `8082078`). TaskService + SkillsImportService gateway-registered; live 200s for tasks/boards; skills bulkImport 400-validation. Maps to issues 001/002.
