# Accessories handoff

Calculator and Paint are implemented on `feat/win95-accessories`. The branch is rebased onto shell commit `c6d244c`, which includes the booting desktop and FileDialog. All application changes stay inside `apps/calculator` and `apps/paint`. Nothing was pushed, and no PR was opened.

The implementation commits end at `a2b61c5`. The final handoff commit also contains this report and the extended browser verification script. The final reply supplies its head SHA.

## Verified behavior

Proof paths below are relative to `D:\codes\worktrees\windows-95-web\proof\accessories`.

| Behavior | Evidence |
| --- | --- |
| Immediate Calculator execution | `executes immediately from left to right`; clicking `12+7*2=` displays 38 in `calculator-clicks.png` |
| Repeated equals | `repeats equals including an omitted second operand`; keyboard `5*==` displays 125 in `calculator-keyboard.png` |
| Windows percent and memory | `takes a percentage of the left operand for Windows percent`; `stores, recalls, adds, and clears memory`; `calculator-percent-memory.png` |
| C, CE, Back, decimal, sign, square root, reciprocal | Engine tests; Electron actions produced 19 after CE, 12 after Back, -12 after sign, 9 after square root, and 0.25 after reciprocal |
| Pending operand handling | `chains computed operands and recalled memory`; `distinguishes a signed operand from memory commands while waiting`; fresh Electron run confirmed results 0 and 10 |
| Divide by zero | `shows Windows error text and recovers through clear`; `calculator-divide-zero.png` |
| Copy, Paste, About | Electron Edit Copy, C, Edit Paste restored 42 in `calculator-electron-clipboard.png`; `calculator-about.png` |
| Pencil, Brush, Line, Rectangle, Ellipse, Fill | Each gesture changes the real canvas; `paint-drawing.png` and `electron/paint-drawing.png` |
| Save and Open | Saved `C:\My Documents\art.bmp`, closed Paint, launched it again, and opened the file. Stored and reopened PNG data URLs equal the original canvas exactly in both browser and Electron. `paint-reopened.png`, `electron/paint-reopened.png` |
| Three Undo levels and Repeat | Three strokes, three Undo actions, and three Repeat actions each match their recorded canvas data URL exactly. `paint-undo-2.png`, `paint-undo-1.png`, `paint-undo-0.png` |
| File association and persisted document launch | Start > Documents > art.bmp opens Paint through its launch arguments. Canvas equals persisted content. `paint-document-launch.png` |
| Eraser and color controls | Right-click changes background to green; Eraser paints with it. Pick Color samples the yellow fill. `paint-eraser.png` |
| Airbrush, rounded rectangle, text | Each draws and undoes to the original image. `paint-airbrush.png`, `paint-rounded.png`, `paint-text.png` |
| Rectangle and free-form selection moves | Selection alone leaves pixels unchanged. Moving changes pixels, and Undo restores the original. `paint-selection.png`, `paint-free-selection.png` |
| Magnifier | Four-times zoom changes rendered width from 440 to 1760 without changing image data |
| Image operations | Rotation swaps dimensions to 280x440; Attributes changes dimensions to 320x240; Invert changes colors; Clear makes every channel white. All undo exactly. `paint-rotation.png`, `paint-attributes.png`, `paint-invert.png`, `paint-clear.png` |
| Electron integration | Both apps launched from Start > Programs > Accessories. `accessories-electron.png` shows both running |

`paint-verification.txt` and `electron-verification.txt` contain the assertion results. The scripts read actual canvas pixels and persisted virtual-drive content. They do not mock the app or call its reducers to simulate input.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm install --offline` | Passed. No packages downloaded or added to the manifest |
| `git rebase feat/win95-shell` | Passed twice, for desktop boot and FileDialog |
| `pnpm test` | Passed. 49 tests across 5 files, including 13 Calculator tests and 9 Paint tests |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed. 59 files checked |
| `pnpm build` | Passed for Electron main, preload, and renderer |
| `pnpm build:web` | Passed |
| `pnpm dev:web --port 5406` | Booted; browser verification passed |
| `paint/verify-tools.ps1` | Passed the core flow and extended tool/image checks |
| `pnpm dev` with `W95_CDP_PORT=9506` and an isolated `W95_DATA_DIR` | Booted; both apps launched through Start |
| `paint/verify.ps1 -Session accessories-electron -Proof ...\accessories\electron` | Passed drawing, persistence, reopen, three Undo steps, and three Repeat steps in Electron |
| `git diff --check` | Passed |

The initial base could not typecheck because of the known shell syntax error. Rebasing the boot commit resolved it. During development, newly added Tailwind classes required a server restart, and app hot updates could retain stale modules. Fresh page loads and the final builds passed.

## Reproduce the browser checks

Start the renderer with `pnpm dev:web --port 5406`. Open `http://localhost:5406` in agent-browser session `accessories`, then launch Paint through Start. Run `src/renderer/src/apps/paint/verify-tools.ps1`. The script creates or replaces its `art.bmp` fixture in My Documents and leaves that saved picture unchanged after verification.

For Electron, use an isolated data directory and CDP port 9506, run `pnpm dev`, and attach session `accessories-electron`. Launch Paint through Start, then run `verify.ps1` with that session. No network service is required.

## Choices and limits

- Model the Domain shaped Calculator's typed reducer and Paint's bitmap/history model. React handles input and presentation; pure modules own arithmetic and pixel changes.
- Sequence Work into Verifiable Units shaped the commit order. Calculator logic was tested and committed before shell integration; Paint followed FileDialog.
- Prove It Works shaped the browser scripts. Persistence and undo assertions compare full PNG data URLs, alongside screenshots and pure tests.
- Calculator uses 15 significant decimal digits and a 260-pixel client width. Windows percent computes a percentage of the left operand for each binary operator.
- Paint stores PNG data URLs under `.bmp` names as requested. It reads that format, not arbitrary binary BMP files. Image dimensions are limited to 1 through 2048 pixels per axis.
- Text uses a modal text entry dialog and commits rendered text to the bitmap. It does not reproduce the original in-place text editing box. Optional Curve and Polygon tools are omitted.
- No original Windows 95 executable was available for a side-by-side comparison. Exact historical sizing and minor interaction details remain judgment calls.
- Clipboard Copy and Paste passed in Electron. The headless browser denied Clipboard read permission and displayed the handled error message, so browser Paste was not counted as passing.
- Explorer is not on this shell branch. File > Open and Start > Documents were verified instead. Portable packaging was not run.

## Shared code and open issues

No app helper needs promotion to shared code. Bitmap operations, history, icons, and encoding helpers are local to Paint.

The shell's title-bar Close button closes the window directly. The current `WindowApi` has no close-interception contract. Paint prompts for unsaved changes through File > New, Open, and Exit, but cannot prompt on title-bar Close. A proposed shared addition is an app-owned before-close callback that can defer the shell close action.

Development hot refresh can encounter the shared `ui/FileDialog -> shell/nodeIcon -> shell/registry -> apps` import cycle. A fresh reload restores the app. No shared files were changed to address that cycle.
