# Explorer unit report

Implemented Explorer, My Computer, and Recycle Bin on `feat/win95-explorer`.
The verified implementation commit is `532637d547572477b53144e23b3b95096e7f383e`.
The branch was rebased onto shell boot commit `35a877c` after the pure model milestone.
The final report commit is above the implementation commit. No push or PR was created.

All implementation files are inside the three assigned app folders. The shared browser component, selection model, sorting, Details columns, stylesheet, and tests live under `apps/explorer/`. Both companion apps import that browser. Filesystem changes go through `fs/store.ts`, and node icons come from `shell/nodeIcon.ts`.

## Evidence

Screenshots are in `D:\codes\worktrees\windows-95-web\proof\explorer\`.
Each filename below resolves against that directory.

| Behavior | Observed result | Proof |
|---|---|---|
| My Computer | Shows C: and 1 object | `navigate-computer.png` |
| Folder navigation | C: shows My Documents and WINDOWS, with RECYCLED hidden | `navigate-drive.png` |
| Open and Backspace | My Documents opens in a new window. Backspace changes its title and contents to C: | `navigate-documents.png`, `navigate-back.png` |
| Large Icons | WINDOWS displayed with 32px icons | `view-large.png` |
| Small Icons | WINDOWS displayed with 16px icons in rows | `view-small.png` |
| List | WINDOWS displayed in vertical columns | `view-list.png` |
| Details | Name, Size, Type, and Modified displayed | `view-details.png` |
| Sorting | Clicking Name reverses names while retaining folders first | `sorted-details.png`; test `sorts descending while keeping folders first without changing the filesystem` |
| Numeric sorting | Size and modified time compare as numbers | Test `sorts sizes and dates numerically` |
| Selection | Click, Ctrl+click, Shift+click, and Ctrl+Shift use visible order and a stable range anchor | Three tests in `Explorer selection` |
| Keyboard selection | Two successive Shift+ArrowDown presses select three entries | `selection-range.png` |
| Select All | Ctrl+A selects all visible entries | `select-all.png` |
| New Folder | File > New > Folder starts inline rename | `create-folder.png` |
| F2 and duplicate names | A duplicate displays the filesystem's Windows error. Enter leaves that dialog open | `duplicate-name.png` |
| Rename | F2 changes New Folder to Explorer Proof | `renamed.png` |
| New text and Cut/Paste | New Text Document renamed to Move Me.txt, then moved from My Documents to C: | `cut-paste.png` |
| Persistence | Move Me.txt remains in C: after renderer reload | `persisted-move.png` |
| Properties | Readme.txt displays name, type, location, byte size, and modified time | `properties.png` |
| Status Bar | View > Status Bar hides the object count | `status-hidden.png` |
| Recycle | Delete confirms before removing Readme.txt from My Documents. Desktop bin icon becomes full | `delete-confirm.png`, `bin-full.png` |
| Recycled Details | Original Location is C:\My Documents and Date Deleted is populated | `recycled-details.png` |
| Restore | File > Restore empties the bin and returns Readme.txt to My Documents | `restored-bin.png`, `restored-document.png` |
| Desktop drop | Dragging the desktop Readme.txt onto Recycle Bin removes it from the desktop and adds it to the bin | `desktop-drop.png` |
| Empty cancellation | No leaves the recycled item intact | `empty-confirm.png`, `empty-cancel.png` |
| Empty confirmation | Yes removes all recycled items and restores the empty desktop icon | `empty-bin.png`, `bin-empty.png` |
| Permanent Delete | Recycle Bin > File > Delete confirms and purges AUTOEXEC.BAT | `purge-confirm.png`, `purged.png` |
| Electron | Start > Programs > Windows Explorer launches C:. My Computer and Recycle Bin stay out of Programs | `electron-start-menu.png`, `electron-explorer.png` |

The navigation, views, file creation, rename, restore, desktop drop, empty, properties, Cut/Paste, status, and persistence checks ran through agent-browser on port 5405. Keyboard range selection, descending sort, single-item purge, and the final Start-menu launch ran in Electron through CDP port 9505. Browser console error checks returned no errors.

Ctrl+click and Shift+click modifier combinations have pure-model coverage. Their exact mouse gestures were not driven in the browser. File > Rename uses the same callback as the verified F2 path, but that menu item was not separately exercised. Text-file launching into Notepad was not verified because the accessories unit is not on this branch.

## Commands

| Command | Final result |
|---|---|
| `pnpm install --offline` | Passed. No downloads or added dependencies |
| `pnpm test` | Passed, 29 tests across 3 files, including 8 Explorer tests |
| `pnpm typecheck` | Passed for both TypeScript projects |
| `pnpm lint` | Passed, 54 files checked |
| `pnpm build` | Passed for Electron main, preload, and renderer |
| `git diff --check` | Passed |
| `pnpm dev:web --port 5405` | Booted and used for the web checks |
| `pnpm dev` | Booted Electron 45. Renderer selected port 5175 because 5173 and 5174 were occupied |

Electron used the isolated data directory `D:\codes\worktrees\windows-95-web\proof\explorer\electron-data` through `W95_DATA_DIR`, and CDP port 9505 through `W95_CDP_PORT`.

Before the rebase, full typecheck and build failed on the foundation's RunDialog string and missing Shell module. Those failures disappeared after the shell boot commit. Live verification found and fixed Enter immediately dismissing a duplicate-name error. The fix prevents the rename key's default action before it opens the dialog.

## Choices and integration notes

- Model the Domain led to one location union for folders, My Computer, and Recycle Bin, and a selection model with separate anchor and focus IDs.
- Sequence Work into Verifiable Units led to the pure-model commit before UI implementation and shell integration.
- Prove It Works led to the browser checks and the final Electron Start-menu run.
- The throughput checkpoint kept one worker inside the three owned folders. Pure tests ran before the shell gate. UI verification followed the shell rebase. No subagents were used.
- Double-click opens a separate folder window. Backspace navigates the current window upward. This is the chosen Win95 folder-window behavior.
- File sizes count UTF-8 bytes. Details rounds nonzero file sizes upward to KB. Program and shortcut nodes have no stored binary payload, so Details leaves their size blank and Properties reports zero bytes. Folder Properties also reports zero rather than calculating descendant sizes.
- Sorting keeps folders first in either direction. Date display uses the host's local time with US formatting.
- Folder-to-desktop drag and drop was optional and is not implemented. Desktop-to-bin dropping is implemented by the manifest callback and verified through the shell's drag handler.
- Nothing in this unit needs promotion to shared code. The shared folder browser belongs under Explorer as requested.
- Shared issue remains in `shell/registry.ts`. The default `installDir` is `C:WINDOWS`, missing the backslash. Proposed shared fix is `app.installDir ?? 'C:\\WINDOWS'`. All three manifests specify `C:\\WINDOWS` explicitly, so this unit installs its executables correctly. No shared files were edited.
- During development, opening folders stopped responding after a hot module update. A full renderer reload restored it, and the final checks ran from fresh page loads. Hot-reload behavior was not repaired in this unit.
