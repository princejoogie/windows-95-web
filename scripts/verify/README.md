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

## Final audit repairs

These are current production Electron checks. Each worker uses its own profile and port. Build once, check that the selected port is free, and launch from the repository root.

```powershell
pnpm install --offline
pnpm build
if (Get-NetTCPConnection -LocalPort 9450 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 9450 is occupied' }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:W95_CDP_PORT = '9450'
$env:W95_DATA_DIR = 'D:/tmp/win95-final-documents'
pnpm start
```

In another terminal, run the document checks. The driver clears the selected test profile between scenarios. It uses trusted CDP mouse and keyboard input, reads persisted files, compares reopened image pixels, and captures screenshots. The optional final argument selects `pictures`, `readonly`, `clock`, `help`, or `charmap`. Omit it to run every scenario.

```powershell
node scripts/verify/finalfix-apps-documents.mjs 9450 D:/codes/worktrees/windows-95-web/proof/finalfix-apps-documents
```

`finalfix-shell.mjs` and `finalfix-shell-assets.mjs` use CDP port 9440 and proof directory `D:/codes/worktrees/windows-95-web/proof/finalfix-shell`. Launch a separate production process with those values before running them. The shell driver accepts `dialogs`, `modeless`, `shell`, `power`, `regressions`, or `existing` as its first argument. Power commands can close that process.

`finalfix-apps-controlpanel.mjs` uses `cdp.mjs` and defaults to port 9452. Launch a separate production process with `W95_CDP_PORT=9452` and a dedicated `W95_DATA_DIR`. Its proof defaults to `D:/codes/worktrees/windows-95-web/proof/finalfix-apps-controlpanel`. `W95_PROOF_DIR` overrides that path. The font format regression check is `node --test scripts/fonts.test.mjs`.

```powershell
$env:W95_CDP_PORT = '9452'
node scripts/verify/finalfix-apps-controlpanel.mjs fonts
```

```powershell
node scripts/verify/polish-housekeeping.mjs
```

## Historical proofs

Files outside the current sets above have a `Historical proof` marker near their first line. These files preserve evidence from earlier rebuild rounds, including their helper modules and capture scripts. They may require an old branch, a dev renderer, a particular saved game, or the original proof directory. Their original usage notes remain in each file.

`polish-housekeeping.mjs` checks that every file is either in the current set above or explicitly marked historical. It also checks JavaScript syntax and rejects report or scratch filenames under `src`. `src/renderer/src/system/README.md` is maintained asset documentation and stays beside the system code.
