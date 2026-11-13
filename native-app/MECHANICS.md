# Loom mechanics recovered from the original executable

Inspected 2026-11-12 in Deep mode. Opened `/home/ed/loom-ide-tauri/target/debug/loom-frontend` with `core_target_open` (218,794,704 bytes, x86-64 ELF, SHA-256 `a53a7a2d91bc338b24c17757a19dc6408f9a3c43d306e40dd8f56fa848e938f1`). Every pseudocode call was awaited and its returned result read. The initial 17 returned function records, including their limitations, are preserved in [docs/native-pseudocode.json](docs/native-pseudocode.json). A second pass reopened the same executable and awaited/read eight additional results, archived in [docs/native-followup.json](docs/native-followup.json). Together these cover 18 distinct functions; repeated reads are identified by their separate evidence IDs.

Addresses below are ELF image virtual addresses, before ASLR. Ghidra rebases this target by **+0x100000**: e.g. `sphere_state` is ELF `0x7ca680`, Ghidra `0x8ca680`. Likewise Ghidra `DAT_00301718` means ELF `0x201718`. Subtract this bias before using `native_bytes_show` or following a data address. Pseudocode is derived evidence, not original source or proof of execution.

## String → reference → function trace

`native_strings_find` searched names, settings and messages, followed by `native_xrefs_list`, `native_function_references_list` and individual `native_function_pseudocode` calls.

| String / data | Reference and function | Evidence |
|---|---|---|
| `Listening — Loom is with you.` at `0x204824` | reference `0x7ce89b` → `SphereState::words`, `0x7ce860` | `ev_271c798e418af8281208ebe0dab3105915c01b8e127c427233de35f5ae1683d3` |
| `reduced_motion` at `0x204f22` | reference `0x7d9495` → Store serializer, `0x7d9020`; deserializer references also returned | `ev_ed1bdf962a8516eaef429f7ffcfa60cedc641ff31ca9a3843c1a84f027816a83` |
| `2 configurations ready … Nothing runs until you choose.` at `0x205895` | reference `0x7eb628` → attention panel closure; experiment controls traced to `0x7e49c0` and `0x7e4690` | `ev_f9a10d160a5548f5c10b12a023249db038bd623a9976d4aad5745345a976edf4`, `ev_cb137b963cfca2d10fb31436cf0efdb67acb0ed9d794cd7ce4e27831ff1496c0` |
| `loom-workspace.json` at `0x203cbf` | references `0x7bdf85`, `0x7be047` → `store_path`, `0x7bde70` | `ev_db087150ad939845f265fbc8e3ac598c7ceb2538857defb71c9f5554eaf0960f` |
| `sphere_state` call to `has_attention` | call at `0x7ca69a` → `has_attention`, `0x7ca790` | `ev_49fa43086647287ffe17020cea1a889d37ecf43e66a1a1ce56316334b76f65fc` |

String searches: `ev_db087150ad939845f265fbc8e3ac598c7ceb2538857defb71c9f5554eaf0960f`, `ev_9ba11732842f645830155a41d6dc8c76390488bc5ec24e1cf571520b64ce959a`, `ev_c896c5668a8c7bec23b7816fb78cb095aa2565fb44d76b75a06743f5ea89bb9e`. These search file data sections, not runtime-generated text. Function-name discovery reports a 50,000-function ceiling and partial coverage; no claim of full-program coverage is made.

## Verified state and interaction rules

| Function (ELF address) | Recovered rule | Build application |
|---|---|---|
| `LoomApp::sphere_state`, `0x7ca680` | In order: open attention panel or `has_attention()` → Attention; elapsed time `< processing_until` → Processing; busy → Executing; nonempty **trimmed** input → Listening; elapsed time `< completed_until` → Completed; otherwise Idle. Equality at a deadline means expired. | `src/mechanics.rs::sphere_state`; `Workbench::current_state`. Pending review and open local activity/review panels take priority over completion. Trimmed input now produces Listening. |
| `LoomApp::has_attention`, `0x7ca790` | `chat_failed.is_some() || demo_step == 2`. | Local errors and pending strategy choices map to attention; local proposal review is an additional workbench attention source. |
| `LoomApp::send_chat`, `0x7cc560` | Trim input; empty input is a no-op. Manual autonomy blocks sending. Accepted input clears the draft and prior failure, appends user message, sets `processing_until = elapsed + 1.5`. Offline appends a demonstration response and sets `completed_until = elapsed + 2.5`; online delegates to `weave`. Calls `persist` afterward. | Trim/empty behavior retained. Offline replies now set the native **1.5-second Processing** deadline as well as **2.5-second completion** feedback. Processing takes priority until it expires, including with reduced motion. The conversation remains explicitly offline; this timer reports UI feedback, not a running model. Other local completed operations use 2.5 seconds. The recovered Manual send guard is now exposed as Keep chat as drafts (Manual). No online adapter or full autonomy selector is connected. |
| `SphereState::words`, `0x7ce860` | Six exact state descriptions listed below. | Used in sphere hover text; Listening added as its own state. Error/Exploring remain local extensions. |
| `App::update`, `0x7ce9e0` | Request repaint after `0x78` = **120 ms** when busy or reduced motion is off. | Replaces the guessed 33 ms continuous redraw. Reduced motion uses event-driven redraws plus deadlines for temporary local feedback. Test/capture mode retains its explicit 10 ms harness override. |

State evidence: `ev_fb613b281dd3bc1cbb170b366adfa18434a2ae17f8dbc0f114721636da10e276`, `ev_b32ac23b51ec420a669b1b74eec52928a8176c4c61eb7c9da908d30f00b75243`. Chat evidence: `ev_59da443342a4d6c4fcec4bd37e17f0cc422fe7eda9f6ffa24c5c2ab829720a55`. Deadlines were decoded as little-endian f64 at ELF `0x201ab0` = 1.5 (`ev_34208ea8bb32ca7fa155ba3ec5c1805bef64e5225c32cd0a659f5c1322bbc6fd`) and `0x2019a0` = 2.5 (`ev_26c574c9cf9fe3a0900f452a8930a1c9c99bb88976a577018c7887d28400474f`). Manual guard additionally checked against ELF relocation `0x18db538 → 0x203c0a` (`readelf -rW`), whose six-byte string is `Manual`; raw on-disk pointer bytes are zero before relocation. Update evidence: `ev_ff6e98b347da631f5d9db53825428f598a5d5f8e7cd7347bbf4f651f1f3a4cc7`.

Exact messages from `words` and bytes `0x204805..0x2048bd`:

- Idle: `At rest — nothing is running.`
- Listening: `Listening — Loom is with you.`
- Processing: `Thinking — preparing a reply.`
- Executing: `An agent is working on your work.`
- Attention: `Needs you — a decision is waiting.`
- Completed: `Done — back at rest.`

Evidence: `ev_20568f9f1ecae548d66565f48b60db8e57e31434bd99993e85666ccb401e332b`, `ev_4576a714bd040cf150046b78ba2e7e498d143d78cd5e0749aa05f9a99a099359`.

## Verified sphere formulas

`LoomApp::paint_scene`, **`0x7c77b0`**, evidence `ev_f1d408140d0f622bce1754f9a1b8bae145a481196316dd37737a9e3281410089`:

- Native layout radius: `r = max(90, min(0.30 * available_height, 300))`. Center: `(rect.center.x, rect.center.y - 0.06 * available_height)`.
- Time: `t = 0` under reduced motion, otherwise elapsed monotonic seconds.
- Glow pulse: `p = 0` under reduced motion, otherwise `sin(0.6*t)*0.5 + 0.5`. Period = `2π/0.6` ≈ **10.47198 s**. This changes halo opacity, **not sphere size**.
- Seven halo layers, `i = 0..6`: `radius_i = r * (1.42 - 0.06*i)`; `alpha = floor(clamp(10 + 8*p, 0, 255))`. Reduced motion gives constant alpha 10.
- Ribbon phase: `phase = float(t * speed)`, where speed is **0.07** for Processing, **0.11** for Executing, **0.02** otherwise.
- Six ribbons, `k = 0..5`; 49 samples, `s = 0..48`. `f=s/48`; `x=cx-r+2*r*f`; `dx=(x-cx)/r`; `half=sqrt(max(1-dx*dx,0))*r`.
- `off=(k-2.5)*r*0.24`; `wob=sin(0.25*t+k)*r*0.03`, or zero under reduced motion.
- `y=cy+off+wob+sin(2*π*f+phase+k)*r*0.05`. Keep points only if `abs(y-cy)<=half`; draw a curve with **three or more points** (`2 < len`). Native line width is **0.8**. Both the cutoff and width are used in the build.
- Native water top is `rect.bottom - 0.16*available_height`; its reflection center is `water_top + 0.34*r`. Six reflection radii are `r*(0.95-0.11*i)`.

Decoded constants (observed bytes): pulse rate f64 `0x201718` = 0.6 (`ev_65a5b025ff968b1bb5751668296f3ba038321c359bb3d08df96c5e51e6ce1c70`); default speed `0x2012f0` = 0.02 (`ev_91619ab9d0c0c5ad3a3f8057eda18a5f74db31bab4feb5b724913ce21c24e915`); processing `0x201bb0` = 0.07 (`ev_990d2bd5a9b051032f2c1f904317804e244ed2e45bb3b99c2775aaf9512cb51f`); executing `0x201d68` = 0.11 (`ev_234030a3120106a9fb2fc8c0d3e8d3325cd0cce2452e7f6fa01c5c40c7368dc4`); wobble `0x201998` = 0.25 (`ev_26c574c9cf9fe3a0900f452a8930a1c9c99bb88976a577018c7887d28400474f`).

f32 data: `0x20320c`=2.5, `0x203268`=8, `0x20329c`=90, `0x203320`=0.34, `0x203324`=48, `0x203370`=0.8 (`ev_a59ff64d586e3969723f197c69805760343d6e8703da931bf55f99129eafb7e3`); `0x203824`=0.30, `0x203828`=300, `0x20382c`=0.24, `0x203870`=0.03, `0x203874`≈π (`ev_9fedbc8b6717820b5de70536ab7a2702e372e5568815249555dc09444155d1a4`); `0x203400`=-0.06, `0x20344c`=0.5, `0x203450`=1.42 (`ev_45e166a3fb4064ae476ecc4b64d881cedc9f10e2713dc9d1ee910c783e40799f`); `0x203548`=0.95 (`ev_fcf6b571357449043e4b0a3f2ff715de3d60cd5e9005bbe2fae5e49542e1f427`); `0x2035f0`=0.05 (`ev_88976acf70edb6e9ffb76bd8bfca4b0085366ff27ff5094169afc6059bfd1792`); `0x2039d4`=-0.11 (`ev_bc7d363e6d3e4eba141c1a770227fc64902334adb2dffa273af776ef89a8155c`); `0x203750`=0.16 (`ev_66a2c6ed8f7b5606ff5cca5813c725e565a3d00592de2decfe70602ffbfa36fa`). Decimal values above are the intended short forms of stored float approximations.

Build: `src/mechanics.rs` implements pulse, halo radii, phase speeds and clipped curves. `orb_image` uses those formulas with stable diameter. Its blue halo RGB channels are premultiplied by the recovered alpha before blending, preserving the required restrained blue artwork instead of copying the original warm glow colors. The required atmospheric blue artwork, its existing reflection, sphere position `(630,435)` and diameter **370 px** on a **1600×900** reference canvas remain design requirements. They differ from the original's warm palette and responsive layout; the rebuild does not pass those design choices off as decompiled values.

## Verified experiment rules

Functions: `experiment_mode` choice closure **`0x7e49c0`** (`ev_cb137b963cfca2d10fb31436cf0efdb67acb0ed9d794cd7ce4e27831ff1496c0`), configuration closure **`0x7e4690`** (`ev_0788047473b15fe47a15e088aa84583a3aa54f080a50baf80221dcb715132dca`), parent **`0x7eb8d0`** (`ev_1a59480b4d7e7cede44df5ca938553ba72580830865f66e6c7d67522ce1afd9f`). Referenced strings decoded at `0x205175` (`ev_fad2639369e8e976694a1294c6baaf0fdf811515797f8407e95bd4f9b7ceb08b`).

| Step | Action and resulting rule |
|---|---|
| 0 | `Record baseline (demonstration)` → 1. Message explicitly says no server experiment ran. |
| 1 | `Prepare comparison` → 2. Two configurations await a decision; `has_attention` becomes true. |
| 2 | Choose A (memory on, **write every turn**, slower replies observed in demo) or B (memory on, **write only when asked**, not measured yet) → 3. Append the choice to the active work, update Unix-seconds timestamp and persist. A real run requires the unavailable server experiment interface. |
| 3 | `Start again` → 0 and clear notice. No timed or automatic progression. |

The build exposes **Experiments → Compare memory strategies**. Its transient stage follows these steps; each choice becomes a timestamped human decision note with audit history in the existing vault. Reopening retains that note. This adapts the original's work-item finding storage to the reconstructed knowledge model; it does not launch a run or fabricate measurements.

**Deferral:** `attention_panel` closure **`0x7e4410`** handles `Decide later` by setting `attention_open=false` and the notice `Left for later. The experiment waits; nothing runs on its own.` It leaves the demonstration stage unchanged and does not persist a decision. At stage 2, `has_attention` therefore remains true after dismissal. The build's explicit `Decide later` button closes the comparison dialog without changing its stage or creating a note; reopening resumes the pending comparison. This adapts the original attention-panel dismissal to the local comparison dialog. Trace: string `0x205137` → reference `0x7e45bc` → function `0x7e4410`. Evidence: `ev_d181caca8366611550ec2c5c7f1eaba7fbf7c353444c90aefe5c7314be48d2c4`, `ev_85ae9df16d4d9c9eaa130a48056ff36fae35c8a98dc0eac2fc9f2f2e94f0dc80`, `ev_29128d2756d85adb2157da42e1caab71bea7e6ffaaf9821f19c7e22088d0a6e9`, `ev_2406ca9cadc25e86dca42ef66e334d7f6f632e2492093f2cb3ae5f2ba45a9b80`.

## Follow-up evidence and corrections

Fresh `native_strings_find` searches covered names/messages and settings (`ev_12c02a801ea0f3cf66b41c16e69de9796a1e458e4b48d2199cf3b6fb2b82af45`, `ev_a73642c0e15ada8c0b523e90a2266ee563d7374d3456a5e0fa35859427e4915d`). Following the incoming reference to `words` located the call at `0x7c871e` inside `paint_scene` (`ev_6dfa3e834cf254a754c9eaeba325ea3479eaf3ea6bfed01b2f31c77350dd0629`). Each of these eight pseudocode results was awaited and read before continuing:

| Function | ELF address | Fresh pseudocode evidence |
|---|---|---|
| Attention deferral closure | `0x7e4410` | `ev_29128d2756d85adb2157da42e1caab71bea7e6ffaaf9821f19c7e22088d0a6e9` |
| `send_chat` | `0x7cc560` | `ev_4117e4506f5bb232122be534cb70bf0f2f82c0b7b30e13dd53153b9780deea99` |
| `SphereState::words` | `0x7ce860` | `ev_83a02d742fde46dbcbd3e331cdd280afcefcc1fec7d7ae9510b14b100af7047c` |
| `paint_scene` | `0x7c77b0` | `ev_f22a7825b476db0d0e90b3014591c84e8dc828b60c85cf7ff1c57a48784087de` |
| Store serializer (`reduced_motion`) | `0x7d9020` | `ev_9f791d844e7d753727fb772b6af2a80fc5df7b64ebe55dfc746f2be6dd8cd414` |
| `sphere_state` | `0x7ca680` | `ev_0ad13109bd1d545cca46bba2709f4c459cc59ac499d337c29f8eac76321d30d1` |
| `has_attention` | `0x7ca790` | `ev_1888280443772047d4925315eb56a97677c5c8fcb4c43acc897f16eebc1c6f2f` |
| Experiment choice closure | `0x7e49c0` | `ev_50842003f9622c04cf432f939f62dde73b87edd1be07ea027ff270507840efd0` |

The previous explanation for omitting offline Processing was incorrect: `send_chat` sets this deadline **before** the online/offline branch, even when its offline response is immediate. This build now follows that rule. The earlier prose also misread `2 < len` as more than three; corrected to at least three, and replaced the build's 0.65 line width with the verified 0.8. The specified blue/lavender artwork and subdued ribbon opacity remain visual adaptations.

## Verified persistence and window setup

- `store_path`, **`0x7bde70`**, returns `current_exe().parent()/loom-workspace.json`, falling back to relative `loom-workspace.json`. `persist`, **`0x7cc0f0`**, clones Store, records mode and scratch notes, serializes pretty JSON and writes it. Evidence: `ev_09051bd6160bf5ad54bba2d57ed6a5d2be360c880eaf775ac8ce730508e3b718`, `ev_46baf03baba6c363521144e98d1c47242e505a498d9a32e1d760fef215d505ff`.
- Store serializer **`0x7d9020`** writes `works`, `active_work`, `chat`, `autonomy`, `mode`, `hypothesis`, `exp_notes`, `reduced_motion`, `code_notes`. The demonstration step is transient. Evidence: `ev_43e5b53a00f5c36673e771c5734d8d4219e21d059dc5bc75a28146bc6cb90f0b`.
- `load_store`, **`0x7bc5a0`**, first attempts JSON loading; its fallback sets `reduced_motion=false`. Some decompiled control flow is incomplete (see below). Evidence: `ev_c592937a0d022b184227958ad4f8b862b2bb6758859bd308ecb66de2bd605a81`. The rebuild already defaults motion to false and persists the preference in `.loom/settings.json`; this was verified again after the change.
- `main`, **`0x7c6eb0`**, contains float bit patterns for initial size **1648×928** (`0x44ce0000`, `0x44680000`) and minimum **900×600** (`0x44610000`, `0x44160000`). These are original values, distinct from the requested 1600×900 workbench canvas and existing smaller-screen support. Evidence: `ev_7cb5b2aff2f1cfaebcdb7568dcd18eb57609cdf482e74a7659cd0857d87efaa5`.

The existing Markdown vault, safe atomic transactions, version history, typed links, human review, search, canvas export, local token estimate, keyboard shortcuts and 1 MiB note cap are **independent workbench features**. No native function address has been established for those rules. In particular, the earlier claim that the 1 MiB cap came from native `workspace.rs` is withdrawn. The historical 59/100 versus 40/100, 19 percentage-point difference, ~4× latency and >2× token use remain **user-supplied fixtures**, not measurements recovered from this ELF.

## Coverage limits and verification

Several returned Ghidra functions incorrectly terminate at `memcpy` marked non-returning: notably network polling `0x7c96e0`, initialization `0x7ca7e0`, settings UI closure `0x7e28e0`, and part of the configuration renderer `0x7e4690`. Their complete returned pseudocode was read and archived, but no missing behavior is invented. Live-network response/error handling and full settings event flow remain unverified. Static analysis did not run or modify the original executable.

Verification artifacts: `../checks/round-0/self-test.json` and `../checks/round-0/self-test.png`, produced by Craft Anything's configured `rebuild_check`. Unit tests check state priority and whitespace, reduced-motion invariance, pulse bounds and circular clipping. The desktop self-test additionally checks actual send-message 1.5/2.5-second deadlines, whitespace-only sends leave both deadlines and messages unchanged, deferral keeps the choice stage without writing a decision, both strategy decisions survive reopening, choices are refused outside the choice stage, attention retains priority, reduced-motion and appearance settings persist, and existing save/search/link/review workflows still work. Reduced motion schedules a redraw at each feedback deadline instead of continuously animating. Build command: `cargo build --offline`; tests: `cargo test --offline`. Latest results: **7 unit tests passed**, **all 9 desktop self-test steps passed**, and `rebuild_check` passed build, self-test, mechanics (**44 values**), and credits. The final screenshot was inspected. The only compiler warning is the existing unused `Exploring` state. Both the 1.5-second Processing timer and 2.5-second completion deadline are active in the build.

## Reconciled visual specification (2026-11-12)

The user confirmed that the mandatory 1600×900 blue/lavender specification supersedes the earlier warm architectural concepts in pictures 2–4. All four images were inspected. The atmosphere now has a subdued lavender lower region and a soft aligned reflection. The recovered glow timing and ribbon trajectories remain, but the halo is a smoothly interpolated surface rather than overlapping discs, and the ribbon opacity is restrained. These rendering adaptations follow the requested visual specification, not additional decompiled rules. The intent accent is at Y=177. Short windows reduce sphere diameter to keep it below the intent; narrow windows disclose conversation in a working drawer.

## Unity-inspired scene preview (independent feature)

More → Scene preview opens a native inspector without changing the specified home layout. Its single sphere has normalized X/Y position [-1,1], scale [0.5,1.5] (default 1), and animation speed [0.25,2] (default 1). Play advances only its local clock; Pause holds it; Stop resets the clock; Reset restores all defaults. Reduced motion freezes the clock. Large frame deltas are capped at 0.1 s. Save persists a validated JSON preset atomically to `.loom/scene-preview.json`; reopening loads it with playback paused. Invalid presets report an error. These are new prototype rules, not recovered native mechanics. No Unity engine is embedded or contacted. Tests cover playback timing, reduced motion, saved-preset round trips and rejection of invalid values; the desktop self-test opens and reopens a saved transform while preserving the home view.


## Fresh verification and applied Manual guard (2026-11-12)

Reopened the original main executable with `core_target_open` in Deep mode (same SHA-256 above). This pass searched names, settings and messages with `native_strings_find`, followed their references, and individually awaited and read these ten `native_function_pseudocode` returns. Complete returned records, including decompiler limitations, are in [docs/native-verification.json](docs/native-verification.json). Identical content can have the same evidence ID as an earlier call; it does not imply a different binary.

| Function | ELF address | Returned pseudocode evidence |
|---|---|---|
| `SphereState::words` | `0x7ce860` | `ev_e2d8fbb51ef4a88fd751f71de99fd5dc2659f48032c8dce655e4327c0b2ebd9a` |
| `sphere_state` | `0x7ca680` | `ev_fb613b281dd3bc1cbb170b366adfa18434a2ae17f8dbc0f114721636da10e276` |
| `has_attention` | `0x7ca790` | `ev_b32ac23b51ec420a669b1b74eec52928a8176c4c61eb7c9da908d30f00b75243` |
| `send_chat` | `0x7cc560` | `ev_59da443342a4d6c4fcec4bd37e17f0cc422fe7eda9f6ffa24c5c2ab829720a55` |
| `paint_scene` | `0x7c77b0` | `ev_f1d408140d0f622bce1754f9a1b8bae145a481196316dd37737a9e3281410089` |
| Work-panel autonomy choices closure | `0x7e9720` | `ev_5e2605a9677bd66141986d1a8754d02bdfa37acdd868e7bded7c3b98ff5fe457` |
| Store serializer | `0x7d9020` | `ev_43e5b53a00f5c36673e771c5734d8d4219e21d059dc5bc75a28146bc6cb90f0b` |
| Experiment choice closure | `0x7e49c0` | `ev_cb137b963cfca2d10fb31436cf0efdb67acb0ed9d794cd7ce4e27831ff1496c0` |
| Attention deferral closure | `0x7e4410` | `ev_29128d2756d85adb2157da42e1caab71bea7e6ffaaf9821f19c7e22088d0a6e9` |
| `App::update` | `0x7ce9e0` | `ev_ff6e98b347da631f5d9db53825428f598a5d5f8e7cd7347bbf4f651f1f3a4cc7` |

Fresh trace examples:

- `At rest` at `0x204805` -> reference `0x7ce884` -> `words` at `0x7ce860`; its caller at `0x7c871e` is inside `paint_scene`. Evidence: `ev_c9d356a05a69c710421b5c76ea8dafb9a1aa408ea8d8fb7f3e2c28b6974b2ef1`, `ev_e1441f5d799a93c3217420dde19bc4000098a6c6fd6ca5dddbecfe8527a4ac12`, `ev_a2cefacbc820707702bce86bac0ce45aba1b31e03ec035acd275abce031d693a`.
- `reduced_motion` at `0x204f22` -> reference `0x7d9495` -> Store serializer `0x7d9020` (also returns deserializer references). Evidence: `ev_ed1bdf962a8516eaef429f7ffcfa60cedc641ff31ca9a3843c1a84f027816a83`.
- `Prepare comparison` at `0x20526a` -> `0x7e4bb1` -> experiment choice closure `0x7e49c0`. Evidence: `ev_f5f880a7adbad3e0770ade0ab3f9c55ffa16ff8226b79b3f948c60c09dce6468`.
- Manual block message at `0x204693` -> reference `0x7cc681` -> `send_chat` `0x7cc560`. Evidence: `ev_afabf9698ef218b9292fd51c09905b54f385e1de2910aca371c4b3c90b3d63e7`, `ev_cf8407b72c5785e2223746fa372c71224ee6dcde76693a969573dbf31de0f890`. The broader search returns 55 of 67 matches (remaining matches are not claimed inspected); only relevant application matches were followed.

**Applied rule:** `send_chat` trims input, returns immediately if empty, then compares autonomy to `Manual`. When Manual, it sets a notice and returns without clearing the draft, appending messages, persisting chat, or changing either deadline. The original exact notice is: `Autonomy is Manual: nothing is sent. Raise it to Assisted to send with approval, or Collaborative to send directly.` Its 115-byte length is confirmed by the pseudocode (`0x73`).

The build now uses `mechanics::prepare_chat` before any message mutation and exposes **Local workspace settings -> Keep chat as drafts (Manual)**. A blocked send keeps the draft verbatim, creates no proposal, changes neither timer and displays the native first sentence followed by instructions for this workbench's offline setting. The preference persists atomically in `.loom/settings.json` as `manual_chat`; old vaults and new vaults retain offline replies by default (`false`). That default, boolean representation, local path and adapted instruction sentence are reconstruction choices. Turning the setting off resumes the existing offline reply workflow; no remote agent is connected.

The original Store serializer confirms autonomy is persisted. The autonomy choices closure `0x7e9720` contains `Manual`, `Assisted` and two additional string pointers but again terminates at incorrectly nonreturning `memcpy`. Its unseen event behavior is unknown; this build does not invent approval or remote execution semantics for those modes. The existing decompiled formulas, state priorities, exact six state descriptions, experiment stages and reduced-motion rules were reconfirmed and retained. The specified blue/lavender appearance and scene-preview additions remain documented adaptations.

Verification for this pass: the unit suite checks Manual/empty guard ordering, legacy settings compatibility and Manual preference persistence. The desktop self-test checks the actual blocked send leaves draft, message count, note count and deadlines unchanged, checks the notice, checks whitespace remains a no-op, and then verifies sending works when Manual is turned off. See the latest build/check results below.

Latest results: **10/10 unit tests and 11/11 desktop self-test steps passed**. `cargo test --offline --manifest-path app/Cargo.toml` passed; `cargo build --offline --manifest-path app/Cargo.toml` succeeded; the final `rebuild_check` rebuilt successfully and passed self-test, mechanics (45 values) and credits. The first desktop run caught a completion timer mutation caused by the generic notification helper; the blocked-send branch now sets only the notice, matching the decompiled rule. The final screenshot at `../checks/round-0/self-test.png` was inspected. The existing unused `Exploring` warning remains. Original executable closed without execution or modification. Full network/settings/autonomy event flow and Phoenix integration remain unverified as noted above.
