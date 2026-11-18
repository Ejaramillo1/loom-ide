# Babylon implementation repair — 17 November 2026

The user's current request removes Unity as the active renderer. The critical
revision and Dashboard reference take precedence over the older diorama plan.
Attached documents are design inputs, not authorization to alter Loom or
uninstall software on other machines.

## Implemented

- Babylon is the only loader target; legacy `?player=unity` no longer activates Unity.
- Pre-ready quality messages are queued; the shell resends saved quality on ready.
- ResizeObserver tracks canvas/container changes, not only window resize.
- Bridge listeners, media listener and observer are disposed on player teardown.
- Page teardown releases the Babylon engine; context loss reports a recoverable error.
- Hidden tabs stop rendering. Quality controls set real resolution scaling with a 2x DPR cap.
- Larger sphere and finer lines; reduced specular highlight and restrained state tint.
- Background selections now change the CSS atmosphere instead of silently doing nothing.
- Specific Babylon module imports cut the spatial entry from 6,317.02 kB
  (1,392.51 kB gzip) to 958.60 kB (224.03 kB gzip), measured in Vite output.

## Verification

138 frontend tests passed (15 files); production Vite build passed;
Tauri 145 passed / 2 ignored; native 22 passed; src-tauri fmt passed.
A headless Chromium screenshot of the built player was captured at 1671x941.
The initial capture revealed an overbright highlight; the material was adjusted.
Chromium reports software-renderer ReadPixels performance warnings, so this is
not evidence of zero browser diagnostics or hardware performance.

## Decisions taken

Use only the installed Babylon core dependency. Keep DOM navigation and real
Loom state. Retain historical Unity sources/assets rather than deleting the
project while desktop validation is outstanding. No Loom changes, machine-wide
uninstallation, external judge edits, or dependency additions.

## Outstanding acceptance work

The complete migration is not claimed finished: inspect final dark/narrow/full
shell screenshots; verify actual Tauri packaging/window and real Loom flows;
measure idle GPU/memory; add engine-level rendering lifecycle coverage; replace
external judge Unity checks through its own authorized project workflow; finally
retire historical Unity source/player files after parity evidence. The critical
revision's full visual target is not yet demonstrated by the standalone renderer
screenshot. Unity recompile is no longer a relevant renderer gate for this repair.
