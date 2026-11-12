# File creation in Obsidian and Loom

Inspected 2026-11-12 with REA against the installed Obsidian 1.15.1 archive.
These are static code observations, not a live UI replay.

## Evidence

- Archive: `/home/ed/.config/obsidian/obsidian-1.15.1.asar`.
- Archive SHA-256: `42bf7f34782752f159d63c17ac6bac4ad01dd55709578f9879f76f8295abb2eb`.
- REA inventory: `ev_8f5acd3679bb0520e472e23019f992b732df8b4b1ffbf784b8816605bf5a92fc`.
- REA extraction: `ev_a4ee5ef532f9ff6bf5369e0153db2b1a801ddac830e4254b35d6ecfaadfdebc3`.
- Extracted renderer `app.js` SHA-256: `31c39502ad7ca49b003ea3fb2fef5889b00160c0290e548e3cc5c6506b8c4d31`.
- Full renderer AST analysis hit its 45-second provider deadline. Partial evidence
  `ev_0255f55a30934e019919a01202a6b951960d16aca1db9aa01058fad539b234dc`
  does not establish behavior. Findings below come from direct inspection of the
  renderer extracted by REA. Offsets are zero-based Unicode character offsets in
  that exact renderer, allowing relocation without copying proprietary code.

## Obsidian's interaction

| Entry point | Observed behavior | Renderer location |
| --- | --- | --- |
| Explorer toolbar | Separate New note and New folder icon buttons call dedicated handlers. | ~1337759 |
| Folder context menu | New note and New folder actions pass the folder to the shared creation flow. | ~1344346 |
| Toolbar New note | Uses the active file and configured new-file location to choose the parent; opens the new note in a tab. | `onCreateNewNoteClick`, ~1346644 |
| Toolbar New folder | Passes no parent; creation defaults to the vault root. | `onCreateNewFolderClick`, ~1346557 |
| File manager | Picks an available path for the default untitled name. New notes are Markdown; folders have their own creation method. | `createNewFile`, ~1585152; `createNewFolder`, ~1585757 |
| After creation | A new note opens in source mode with its title selected for renaming. A folder is sorted, revealed and put into inline rename. | `afterCreate`, ~1349012 |
| Inline rename | Enter saves; Escape leaves rename mode. Validation errors appear beside the item. | `startRenameFile`, ~1354112 |

## Loom adaptation

Loom previously exposed only directory listing and text-file reading. Its two
editor notes use localStorage; workspace files open read-only.

The Code explorer now has separate New file and New folder toolbar controls for
the workspace root. A folder's ellipsis button or context menu offers both
actions inside that folder. The name form shows its destination, accepts Enter,
and supports Cancel/Escape. Errors stay beside the name. Repeated submits are
disabled while creation is pending.

Unlike Obsidian's untitled-then-rename flow, Loom asks for the name first. This
supports arbitrary code-file extensions without introducing a rename command or
leaving unwanted untitled files after cancellation. A collision asks for another
name and never replaces an existing entry. New files open in the existing
read-only viewer; new folders expand in the tree. Workspace editing is a separate
capability.

The Rust commands perform the actual filesystem creation independently of the
Loom server. They validate a single entry name, resolve the existing destination
inside the workspace and use exclusive creation. Dotfiles are included in the
tree so a new `.gitignore`, for example, remains visible. A refresh failure after
successful creation is reported as such, without inviting a duplicate retry.
