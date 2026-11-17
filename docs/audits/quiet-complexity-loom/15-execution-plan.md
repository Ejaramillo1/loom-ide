# 15 — Execution plan: baseline, single work queue, progress

> Created 2026-11-16 under the owner's two-phase plan: **make the report
> accurate, then collect the missing proof and fix the remaining
> behavior.** Reuses the existing roadmap (`09-remediation-roadmap.md`,
> `12-current-state-recheck.md`, `14-report-evaluation.md`) — this file is
> the operational tracker, not a competing report. "Implemented" = the
> repair exists in the tree; "Verified" = the required check actually
> passed with recorded evidence; "Blocked" = an external prerequisite is
> missing, named exactly.

## 1. Baseline (recorded 2026-11-16 ~20:10 local)

**Repositories (every later result answers "which exact version"):**

| Repo | Path | Branch | HEAD | State |
|---|---|---|---|---|
| IDE | `/home/ed/loom-ide-tauri` | `tauri-prototype` | `f75ad9f498106bf676182d5e563794e8e196bd54` ("Docs: correct stale QC-07 recheck claim and HITL-card test comment") | ahead 36 of origin; **uncommitted work present** (see below) |
| Loom | `/home/ed/work/loom` | `main` | `8082078f050008d97d09d5bdf13eebf347f32d91` ("Gateway: register Task/Skills services, answer stored HITL requests, consume WeaveRequest.context, return TraceId") | ahead 1 of origin, clean |

**Implementation range (canonical for all commit/line counts):**
`f7217bc..f75ad9f` — **23 commits**; source tree (excluding audit docs):
**18 files, +3,889/−400**; audit docs: 6 files, +997; total:
40 files, +5,502/−415. Round boundaries (source commits):
`58cce7b` issue-016 lifecycle, `bdb92bb` issues-017/003 framing+NDJSON,
`7f93a2f` QC-13/17 + slot origin, `b6c612f` QC-08/11/12/21/22 + issue 009,
`ff272af` QC-07 route, `a714b20` QC-14/issue 008, `1959b2b` QC-09
continuation record, `a02ad52` QC-01 copy truth, `52c652a` QC-15/16/18/19,
`de3b4fc` review fixes, `1c6efb8` coherence, plus the 3D-scene and ledger/
verify commits. Loom side: `ab46f76f..8082078` = **1 commit, 4 files,
+203/−3** (`cmd/looms/cmd_serve.go`, `pkg/server/http.go`,
`pkg/server/multi_agent.go`, `pkg/server/request_context_test.go`).
Doc 14's "+5,416/−783 across 46 files, 7f93a2f…f75ad9f" is **wrong on
every number** and is corrected by this file.

**Running Loom binary:** `/home/ed/.local/bin/looms`, 110,834,576 bytes,
built 2026-11-15 19:13 — matches Loom `8082078` (doc 13 §1). `looms
--version` → 1.4.0. **Server process: NOT RUNNING** at baseline (`ss
-tln` shows no listeners on 5006/60051/1420). Live steps require the
owner's server or an authorized start (see W-6).

**Server bind facts (for W-6):** HTTP address = `config.Server.Host:
HTTPPort` (`cmd_serve.go:3821`), gRPC = `--host` (default `0.0.0.0`).
A loopback-only test deployment is `looms serve --host 127.0.0.1
--http-port 5006 --port 60051 [--db <disposable>] [--config <...>]`.
The owner's default DB is `/home/ed/.loom/loom.db` (personal — never
targeted by tests).

**Toolchain:** node v24.22.1 · npm 11.19.1 · cargo 1.99.1 · rustc
1.99.1. Test runner: vitest 5.1.0.

**Working-tree state (separated):**
- **Tracked modifications — NOT OURS:** `public/spatial-player.js`,
  `src/main.ts` (+34), `src/spatial*.ts/test.ts`,
  `unity-memory-palace/Assets/Loom/MemoryPalaceController.cs`,
  `unity-memory-palace/Tools/CheckWorkbench.cs`, plus new untracked
  `unity-memory-palace/Assets/Loom/{Resources/Textures,Shaders}/`,
  `Tools/ConfigureHdri.cs`. These belong to the **peer task
  20261116-195041** (selectable 3D-scene backgrounds, still running at
  baseline). Do not stage, commit, or conflict with them.
- **Untracked audit corpus:** `docs/audits/quiet-complexity-loom/**` —
  the merged audit, its evidence, and the corrected reports. Staged
  explicitly, file by file, in the commit step.

**Data-directory facts (for W-5, verified in source):**
- Work/Intents/Experiments: `app.path().app_data_dir()/loom-ide/*.json`
  (`lib.rs:98-124`) — Tauri app-data for identifier `com.loom.ide`,
  which honors `XDG_DATA_HOME` on Linux (`tauri.conf.json:39`). Empirical
  confirmation at launch is part of W-5 (do not assume the env var moves
  every store).
- Vault: `LOOM_VAULT_DIR` env override, default = checkout's
  `native-app/Research Vault` (`knowledge.rs:71-77`, QC-16-compatible
  setting). A disposable vault is therefore achievable without code
  changes.
- Server address: `LOOM_ADDR` (default `127.0.0.1:5006`).

**Contract facts that constrain later work (verified in Loom `8082078`
source):**
- `WeaveRequest.timeout_seconds` **IS enforced** — `context.WithTimeout`
  in the weave paths (`multi_agent.go:4209-4211`, `4351-4353`).
- `WeaveRequest.max_rounds` has **no consumer** in the weave path (no
  `MaxRounds` reference in `pkg/server`/`pkg/agent`); per-turn rounds are
  governed by agent config `max_turns` (`agent.go:2718`). Wiring
  `max_rounds` therefore cannot be enforced end to end without Loom-side
  work — record honestly in W-10.
- Approval holds: `POST /v1/human-requests/{id}:respond` with status
  vocabulary `approved`/`rejected`/`responded` (Loom `8082078`), shared
  `HumanRequestStore`; the IDE routes there (`main.ts:5491-5504`).
  Parked-turn 409 refusal is source-confirmed, not live-tested.

## 2. Evidence standards (for every number in this plan)

1. Record the exact command, working directory, and tested commit for
   every run; capture **complete output** to
   `docs/audits/quiet-complexity-loom/evidence/exec-20261116-<name>.log`
   and the exit code **immediately after** the command (no reordered
   `echo`s).
2. `cargo fmt --check` is recorded **per manifest**: src-tauri and
   native-app separately. The earlier
   `evidence/eval-20261116-fmt.log` opens with a missing-manifest error
   (run from the repo root without `--manifest-path`) yet records
   `FMT_EXIT=0` — that recording is invalid and is superseded here.
3. Test counts come from runner output only (e.g. vitest "Tests 15
   passed (15)"), never from file greps or copied prose.
4. Live claims name the profile used and never reuse a personal session
   (never `sess_d7f154c9`; synthetic sessions such as `sess_b05e656f`
   are fixtures, not personal data).

## 3. Work queue (single list; Problem / Change / Proof / Status / Evidence)

### A. Report corrections (the six named overclaims)

| # | Problem | Change | Proof | Status | Evidence |
|---|---|---|---|---|---|
| R1 | Lifecycle tests described as if they traverse the real app pipeline | Describe them as 15 tests over the **extracted real handlers with a minimal fake DOM and mocked Tauri bridges** — not the real Tauri event pipeline or a rendered window | Docs say exactly that; UI-path verification stays open (NG-4) | **done** | 00/08/14/README corrected; vitest "Tests 15 passed (15)" |
| R2 | "The gap is closed" for the patched UI path (14 §2 row 8, 08 §"now false") | Keep verification through the rebuilt UI **open**: both ends are pinned, the middle (real bridge + rendered window) is not | NG-4 remains open with its blocker named | **done** | 00/08/14/README corrected |
| R3 | HITL routing described as fully verified | Say: routing is **fixed** (IDE + Loom `8082078`, live route probes pass) — a **successful held-request round-trip (approve → tool actually runs) is still unverified** | Docs state the residual explicitly | **done** | 00/14/README/qc-07 corrected |
| R4 | "All terminal shapes tested" (14 §4, 00, 01, README) | Replace with the actual tested cases: error text, stage-8/FAILED-without-error-text, EOF-before-completion, truncation-mid-chunk, error-after-completion, cancel-after-completion, cancel-during-silence. Untested: malformed JSON `data:` frames as a distinct case, completion-then-truncation, cancellation exactly at EOF | Docs list only the fixture names that exist | **done** | 00/01/README/14/qc-04 corrected |
| R5 | Old audit (b1f16bd/7f65bfc refresh) referenced as current | Mark it **historical and superseded**; current conclusions cite `f75ad9f`/`8082078` | 00/01/README/08 headers + 14 §1 all state this | **done** | headers already carry it; 14 §1 corrected |
| R6 | NG-2 (execution limits, functional) lumped with doc-cosmetic items ("documentation tail … NG-1/N G-2", 00 §4, 14 §4) | Separate: NG-2 is a **functional** gap (W-10); NG-3/issue 015 is **documentation copy** (W-12); NG-1 is **tooling scope** | Each NG item carries its own severity and queue slot | **done** | 00 §4, §6, 14 §4, 01 new-gaps corrected |

### B. Numbers and evidence collection

| # | Problem | Change | Proof | Status | Evidence |
|---|---|---|---|---|---|
| E1 | Doc 14's commit/line counts are wrong | Publish the canonical range `f7217bc..f75ad9f`: 23 commits; source 18 files +3,889/−400; audit docs 6 files +997; total 40 files +5,502/−415; Loom 1 commit, 4 files +203/−3 | 14 corrected; counts reproducible via the exact commands in §1 | **done** | `git rev-list --count`, `git diff --shortstat` (this run); 14 §1 corrected |
| E2 | "16 tests" appears in 14 and 08; the file has 15 | Correct to 15 everywhere; cite the runner output | grep finds no "16 tests" for chat-lifecycle | **done** | vitest run 2026-11-16 20:09: "Tests 15 passed (15)"; 14 §2 row 8 and 08 corrected |
| E3 | fmt evidence mixes a missing-manifest error with FMT_EXIT=0 | Re-record: src-tauri `cargo fmt --check --manifest-path src-tauri/Cargo.toml` (exit 0) and native-app (exit 1, pre-existing debt since `41170a6`) as two separate logs with exit codes; supersede `eval-20261116-fmt.log` | Logs show per-manifest results and real exit codes | **done** | `evidence/exec-20261116-fmt-src-tauri.log` (EXIT=0), `exec-20261116-fmt-native-app.log` (EXIT=1, 1886-line diff) |
| E4 | All six required checks re-run at head | Run the six commands at `f75ad9f` with the §2 capture standard | Six fresh logs, exit codes recorded | **done (Unity deferred)** | `evidence/exec-20261116-*.log` — frontend 95/95 (incl. peer's uncommitted spatial tests; committed state 93), build exit 0, tauri 125/2, native 22, fmt src-tauri 0, fmt native-app 1. Unity deferred: the peer task owns the only running Editor (port 7800) mid-import |

### C. Product work (fixes + proof), ordered

| # | Problem | Change | Proof | Status | Evidence |
|---|---|---|---|---|---|
| W-1 | Execution limits never sent (NG-2); Intent-budget direction | Wire Intent budget fields → editor → TS API → Rust validation → **both** weave requests (`max_rounds`, `timeout_seconds`); preserve existing saved Intents with documented defaults | Rust wire tests assert both fields; **caveat verified: Loom enforces `timeout_seconds`; `max_rounds` has no server consumer** — record honestly and gate the max_rounds claim on Loom-side work or agent `max_turns` | **open** | `multi_agent.go:4209/4351` (timeout enforced); no `MaxRounds` consumer; docs direction TBD in DECISIONS |
| W-2 | Autonomy unenforced (QC-01) | Define what the 4 existing levels permit; inventory every entry point (chat, experiment arms, workflows, resume, schedules, tools); enforce applicable restrictions at the Rust boundary; specify the runtime contract for lowering during an active run; no invented levels, no prompt-wording-as-permission | Forbidden actions cannot execute via any entry point; UI reports enforcement accurately; full runtime enforcement stays open until Loom-side work exists | **open** | a02ad52 (copy truth) landed; enforcement open |
| W-3 | Gateway posture (QC-02) | Local test deployment: loopback-only binds, Tauri origin works, foreign origin gets no read, unary + stream same policy; remote deployment = separate authenticated transport (out of scope) | Observed `ss` addresses + origin probes match the documented local deployment | **spec ready; live check blocked on server start** | §1 bind facts |
| W-4 | Disposable playground | Disposable `XDG_DATA_HOME` app profile + `LOOM_VAULT_DIR` vault + synthetic sessions + temp work; fixtures never demo data; empirically confirm the app-data dir at launch | Launching checks cannot touch personal notes/sessions/approvals | **open** | §1 data-dir facts |
| W-5 | Approval buttons prove control (QC-07 round-trip) | Harmless counted tool in the isolated env; cases: no-approve→0, approve→1, repeat-approve→1, deny→0, expired answer→server's expired state, reload/restart→stored decision; plus the parked-request refusal; pending requests only via the runtime's supported path | UI, stored request, and actual tool execution agree | **blocked — needs live server + held tool** | doc 13 Phase 3 (route only) |
| W-6 | Live chat journey through the rebuilt UI (NG-4 / criterion 1) | Launch from `f75ad9f` with the disposable profile; temp work item + session + agent; harmless message; observe streamed answer; same session on message 2; View trace belongs to the turn; run record on the right work item | Observed complete UI→Tauri→Loom→UI journey; a CLI probe does not count | **blocked — server not running; owner start or authorization needed** | doc 13 §1c (wire only) |
| W-7 | Failure/Stop gaps through the app | Keep existing fixtures; add only real gaps: malformed-JSON frame case, completion-then-truncation, cancel-at-EOF (verify each is a real gap first); controlled responses for fail-before-answer, fail-after-partial, cut-off, Stop-during-silence, overlapping requests, repeated terminal — each with evidence at the layer claimed | Each listed case has recorded evidence; partial stays visibly partial; drafts survive; every request settles once | **open** (fixtures for several cases exist; gap analysis first) | `loom_stream.rs` fixtures; `chat-lifecycle.test.ts` 15 tests |
| W-8 | Docs + environment tail (issue 015/NG-3, NG-1) | Fix philosophy citations (`documentation/…` → `docs/…`); correct the attention-dialog sentence ("comes from the Loom server" — false for local decisions); decide + record native-app fmt scope (format once vs stated exclusion) | Citations resolve; copy matches behavior; every "fmt ✓" names its scope | **open** | main.ts:3431; docs/01-design-philosophy.md:28-58 |
| W-9 | Unity + real-window checks (NG-5, D14) | Unity recompile + CheckWorkbench when an Editor is available; real-window CSP/pixel check; rerun the six suites at the final commit | Editor-green results or an explicit environment blocker | **blocked — no Unity Editor running** | doc 13 §5 |
| W-10 | Reassessment + commits | Reassess the seven completion criteria; commit each logical slice locally, staging only intended files (never the peer task's spatial work) | Every "verified" label has matching evidence; every gap names its unblock condition | **open** | this file |

## 4. Progress log

- 2026-11-16 ~20:10 — baseline recorded (§1); plan + queue written.
- 2026-11-16 ~20:15 — **R1–R6 applied** to 00/01/08/README/14 + qc-04/
  qc-07 status blocks; **E1–E4 executed** (canonical git numbers,
  lifecycle count 15, per-manifest fmt logs, six fresh suite logs at
  `f75ad9f`). Committed in the correction slice. Unity checks deferred:
  the peer task (20261116-195041) owns the only running Editor (port
  7800) and is actively staging Unity assets — no Unity commands were
  run to avoid colliding with its session.
- Remaining: W-1..W-10. W-3/W-5/W-6 are blocked on the Loom server (not
  running at baseline) — unblock condition: owner starts `looms serve`
  loopback-bound, or authorizes this agent to start it with a disposable
  `--db`/profile.
