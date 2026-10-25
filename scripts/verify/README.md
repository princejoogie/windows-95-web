# Verification scripts

The current final-polish checks use a dedicated Electron profile and CDP port 9420. Run them from the repository root.

```powershell
$env:W95_CDP_PORT = '9420'
$env:W95_DATA_DIR = 'D:/tmp/win95-polish-data'
pnpm build
pnpm start
```

In another terminal, run each current scenario. Each scenario clears only this test profile's virtual desktop data.

```powershell
node scripts/verify/polish.mjs menu
node scripts/verify/polish.mjs help
node scripts/verify/polish.mjs undo
node scripts/verify/polish.mjs shortcut
node scripts/verify/polish.mjs capacity
node scripts/verify/polish.mjs abouts
node scripts/verify/polish.mjs desktop
node scripts/verify/polish-housekeeping.mjs
```

`polish.mjs` uses `cdp.mjs` for trusted mouse and keyboard input. Proof defaults to `D:/codes/worktrees/windows-95-web/proof/polish`. `W95_PROOF_DIR` overrides that directory. The capacity scenario creates two virtual folders containing ten Paint program nodes each. Their logical size is 3,112,960 bytes per folder. Deleting them through the desktop exercises the real Recycle Bin limit without filling browser storage with large text files.

## Doom episode

Stop the production app before starting the dev app on the same CDP port. The episode driver reads a dev-only game session to aim and route. It plays through keyboard input and does not write game state.

```powershell
$env:W95_CDP_PORT = '9420'
$env:W95_DATA_DIR = 'D:/tmp/win95-polish-data'
pnpm dev --config scripts/verify/polish.config.mjs
```

In another terminal:

```powershell
$env:W95_NO_DEATHS = '1'
$env:W95_PROOF = 'D:/codes/worktrees/windows-95-web/proof/polish'
node scripts/verify/doomfix-episode.mjs 9420 2
```

The route picks up the existing shotgun and shells, then the new Reactor armor. It visits the nearby medikit after the opening fight. Strict mode fails on the first death. The script writes `episode.jsonl` and screenshots through the finale.

## Historical proofs

Every other file in this directory has a `Historical proof` marker near its first line. These files preserve evidence from earlier rebuild rounds, including their helper modules and capture scripts. They may require an old branch, a dev renderer, a particular saved game, or the original proof directory. They are not the current acceptance suite. Their original usage notes remain in each file.

`polish-housekeeping.mjs` checks that every file is either in the current set above or explicitly marked historical. It also checks JavaScript syntax and rejects report or scratch filenames under `src`. `src/renderer/src/system/README.md` is maintained asset documentation and stays beside the system code.
