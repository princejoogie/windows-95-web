# Minesweeper implementation report

Implemented on `feat/win95-minesweeper` in `D:\codes\worktrees\windows-95-web\t3-c2d4840f`. The branch was rebased onto shell boot commit `35a877c`. The final handoff message records the head SHA.

All unit changes are under `src/renderer/src/apps/minesweeper/`. No dependencies, shared source files, remote resources, pushes, or PRs were added. No subagents were spawned.

## Verified behavior

Screenshot paths below are relative to `D:\codes\worktrees\windows-95-web\proof\minesweeper\`.

| Behavior | Evidence |
| --- | --- |
| Safe first click | `opens a safe region on 20 seeded first clicks at every preset level` checks 60 boards. The maximum-density custom test checks another 20 boards. |
| Flood fill | `flood fills connected zeros and their border without opening flags`; `opened-region.png` shows seed 42 opening 63 cells. |
| Middle-click chording | Rule test plus browser assertion that cell 10 opens; `chord-held.png` and `chord-open.png`. |
| Left+right chording | Browser assertion that cell 0 opens after holding both buttons on cell 10. |
| Incorrect flags on a chord | `loses when chording with the correct count of incorrectly placed flags`. |
| Win and best-time prompt | `win.png`, `win-name.png`; browser assertions verify sunglasses, 10 flags, and the name dialog. |
| Best-time persistence and reset | `best-times.png`; the browser script saves Ada, reloads and relaunches, verifies the name, then resets all three records. |
| Loss | `loss.png`; browser assertions verify the red mine, 10 revealed mines, one crossed-out wrong flag, and the dead face. |
| Beginner, Intermediate, Expert | Browser assertions verify 81, 256, and 480 cells. `beginner.png` and `expert.png` show the fixed window resizing with the board. |
| Level persistence | `expert-restarted.png`; reload and relaunch preserve Expert with 480 cells. |
| Custom clamping | `custom-clamped.png`; entering 99/99/999 produces width 30, height 24, and 667 mines. Unit tests also cover minimums and invalid numbers. |
| Timer | Browser assertions verify starting on reveal, pausing while minimized, resuming, and stopping on both win and loss. `timer-resumed.png`. `starts the clock on reveal and caps it at 999 seconds` verifies the cap. |
| Flags, questions, negative counter | `negative-counter.png`, `question-mark.png`; browser assertions verify -1, flag/question/blank cycling, and skipping questions with Marks off. |
| Faces and cell art | `beginner.png`, `chord-held.png`, `win.png`, and `loss.png` show all four faces. |
| Color and About | `monochrome.png`, `about.png`; Color toggles the board display. |
| New and Exit | Browser assertions verify that F2 clears the board and Exit closes the app. The face button also starts seeded games during the same run. |
| Electron integration | `electron-start-menu.png` and `electron-playing.png`. Launched through Start > Programs > Accessories > Games > Minesweeper, revealed a region, and exited through Game > Exit. |

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm install --offline` | Passed. No downloaded packages. Run before model work and after the shell rebase. |
| `pnpm typecheck` | Passed on the integrated branch. The scaffold initially failed in `shell/RunDialog.tsx`; rebasing onto the shell boot commit resolved that base error. |
| `pnpm lint` | Passed, 55 files, no changes or warnings. |
| `pnpm test` | Passed, 34 tests in four files. Minesweeper contributes 13 tests in two files. |
| `pnpm build` | Passed for Electron main, preload, and renderer. |
| `pnpm build:web` | Passed. |
| `git diff --check` | Passed. |
| `pnpm dev:web --port 5402` | Started and served the live browser checks. |
| `powershell -NoProfile -ExecutionPolicy Bypass -File src/renderer/src/apps/minesweeper/verify.ps1` | Passed all 31 assertions. Uses the named `minesweeper` agent-browser session and regenerates the web screenshots. |
| `pnpm dev` | Started Electron 45. Used `W95_CDP_PORT=9402` and a dedicated `W95_DATA_DIR` under the system temporary folder. The renderer selected available port 5176. |
| `agent-browser --session minesweeper-electron connect 9402` | Connected to the real Electron app and drove the Start-menu launch. |
| `agent-browser ... errors` | No browser application errors reported in either session. |

The browser script uses a fixed random seed to produce a real game. It performs mouse and keyboard actions through agent-browser and asserts rendered controls. It does not replace game state or network responses. It resets only Minesweeper preferences in its dedicated browser session.

## Design choices and shared-code candidate

Model the Domain led to the `ready`, `running`, `won`, and `lost` state machine with immutable rule transitions. Sequence Work into Verifiable Units led to a tested model commit before the UI commit. Prove It Works led to the rerunnable browser script and the separate Electron check.

The shared Dialog centers itself over its owner, which clips a 300px dialog when the 174px Beginner window is near the left edge. `MineDialog.tsx` adds viewport correction inside this unit. Its positioning logic is a candidate to promote into `ui/Dialog.tsx`; the shared component was not edited.

Judgment calls, made offline:

- Custom dimensions use width 9 through 30 and height 9 through 24, with 10 through `(width - 1) * (height - 1)` mines. The minimum matches the brief's 9x9 Beginner requirement.
- First-click placement reserves the clicked cell and its neighbors when there is room, so preset games always open a region as required by the proof table.
- The clock also pauses while an app dialog is open, in addition to an unfocused or minimized app window.

## Limits and open issues

No blocking issues remain in the requested unit. Original Windows 95 pixel-by-pixel parity was not compared against an emulator or reference screenshot. The packaged installer was not tested. The 999-second cap was tested in the pure model rather than by waiting 999 seconds in the UI. Electron received the Start-menu/play/Exit smoke test; the full rule and menu verification ran in the shared web renderer.

Independent agent review was intentionally skipped under the worker instruction. The app-local viewport helper is the only proposed shared-code promotion.
