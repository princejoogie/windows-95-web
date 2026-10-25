# Solitaire handoff

Branch `feat/win95-solitaire`. Based on shell commit `35a877c`. Only `src/renderer/src/apps/solitaire/**` changed.

The app has Klondike rules, pointer dragging, manual flips, double-click foundation moves, Standard and Vegas scoring, one-level undo, a clock, four card backs, options, and a bouncing-card win animation. Cards and both icons are generated in code.

| Behavior | Evidence |
| --- | --- |
| Legal and illegal tableau and foundation moves | `game.test.ts`, suite `Klondike deal and moves` |
| Draw One, Draw Three, and Vegas recycle limits | `game.test.ts`, suite `stock cycles` |
| Standard events, timed deductions, and undo | `game.test.ts`, suite `Standard scoring and undo` |
| Vegas events, None scoring, and timed win bonus | `game.test.ts`, suite `Vegas, no scoring, and winning` |
| Three-card run moves legally and snaps back illegally | `D:/codes/worktrees/windows-95-web/proof/solitaire/legal-run.png`, `illegal-drop.png` |
| A click flips the exposed card after dragging | `D:/codes/worktrees/windows-95-web/proof/solitaire/manual-flip.png` |
| Draw Three fans cards and recycles in the same order | `D:/codes/worktrees/windows-95-web/proof/solitaire/draw-three.png`, `stock-recycled.png` |
| Vegas limits also work through the UI | `D:/codes/worktrees/windows-95-web/proof/solitaire/vegas-draw-one.png`, `vegas-draw-three.png` |
| Options, outline dragging, and alternate card backs | `D:/codes/worktrees/windows-95-web/proof/solitaire/options.png`, `outline-drag.png`, `decks.png`, `castle-deck.png` |
| Near-won deal finished by a double-click plays the cascade | `D:/codes/worktrees/windows-95-web/proof/solitaire/win-cascade.png` |
| Click and F2 stop the cascade; minimizing pauses the clock | Assertions in `verify-live.ps1` |
| Resize and Maximize keep cards legible | `D:/codes/worktrees/windows-95-web/proof/solitaire/resized.png`, `maximized.png` |
| Electron launch through Start > Programs > Accessories > Games | `D:/codes/worktrees/windows-95-web/proof/solitaire/electron-start-menu.png`, `electron-solitaire.png` |

| Command | Result |
| --- | --- |
| `pnpm install --offline` | Passed. No packages downloaded. Repeated after rebase. |
| `pnpm test` | Passed. 41 tests in three files. |
| `pnpm exec vitest run src/renderer/src/apps/solitaire/game.test.ts` | Passed. 20 Solitaire tests. |
| `pnpm typecheck` | Passed after shell rebase. The initial scaffold failed in its existing RunDialog. |
| `pnpm lint` | Passed. 54 files checked. |
| `pnpm build` | Passed. Electron main, preload, and renderer built. |
| `pnpm build:web` | Passed. |
| `pnpm dev:web --port 5403 --strictPort` | Booted and used for live checks. |
| `powershell -NoProfile -File src/renderer/src/apps/solitaire/verify-live.ps1` | Passed. Drives native pointer and keyboard input and checks rendered results. |
| `pnpm dev` | Booted Electron. Launched Solitaire from the Start menu through CDP on port 9403. |
| `git diff --check` | Passed. |

Development builds accept `?solitaireDeal=run`, `?solitaireDeal=win`, and `?solitaireSeed=95`. Production web and Electron bundles were inspected and exclude these hooks. The proof deals preserve all 52 distinct cards. Their last moves run through the same reducer as normal play.

Model the Domain shaped the immutable reducer and single undo snapshot. Test Behavior, Not Implementation shaped the move and score assertions. Prove It Works shaped the real pointer checks and Electron launch. The worker constraint kept design, implementation, and self-review in this worktree without subagents.

Judgment calls follow known Windows 95 behavior. Standard undo restores the previous score with a two-point penalty. Draw Three deducts 20 on each recycle after three passes. The timed bonus is the integer part of `700000 / seconds` after 30 seconds. The clock begins with the first successful action and pauses while inactive. Changing draw, scoring, or timed mode deals again. Display options preserve the board.

No shared helper needs promotion. No dependencies were added. No push or PR was attempted.

No known functional blocker remains in the tested flows. Court cards and backs are procedural approximations. They were not compared pixel for pixel with an original Windows 95 executable. Full gameplay was driven in the web renderer; Electron verification covered the Start menu launch and rendered table. No independent reviewer was used because the worker brief prohibits subagents.
