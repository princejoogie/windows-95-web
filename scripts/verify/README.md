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

`finalfix-apps-controlpanel.mjs` uses `cdp.mjs` and defaults to port 9452. Launch a separate production process with `W95_CDP_PORT=9452` and a dedicated `W95_DATA_DIR`. Its proof defaults to `D:/codes/worktrees/windows-95-web/proof/finalfix-apps-controlpanel`. `W95_PROOF_DIR` overrides that path. Pass `--fresh` to clear that connected test profile before each scenario. The driver uses trusted input for interactions and writes screenshots, runtime targets, assertions, and persisted values.

```powershell
$env:W95_CDP_PORT = '9452'
node scripts/verify/finalfix-apps-controlpanel.mjs accessibility --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs tcpip --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs regional --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs shortcuts --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs printer-shortcut --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs font-shortcuts --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs stale-shortcut --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs fonts --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs font-negative --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs font-linked --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs font-virtual --fresh
node scripts/verify/finalfix-apps-controlpanel.mjs consumers --fresh
pnpm exec vitest run scripts/fonts.test.mjs
```

The accessibility, TCP/IP, and regional scenarios assert draft, Apply, Cancel, and reload behavior. Shortcut scenarios launch desktop links, including Add Printer and font samples. `stale-shortcut` installs a linked virtual font, creates its desktop shortcut, recycles the source, reloads, and verifies a dismissible error plus keyboard selection, F10 menu access, and Close. The printer shortcut scenario applies a 1995 date and checks the persisted creation year. Font scenarios cover actual font bytes, missing media, rejected input, copied and referenced installation, and semantic font families after WordPad Save and Open. The consumer scenario checks Chromium's rendered font records and retains the legacy font choices. `baseline` targets the original broken revision. `stale-shortcut --baseline --fresh` reproduces the invisible-dialog failure at commit `16766fc`. `exit` closes only the connected test app through its host shutdown API.

To check the portable executable, run `pnpm package`, close the owned production process, and launch `release/Windows 95-win32-x64/Windows 95.exe` with port 9452 and another dedicated profile. Set `W95_PROOF_DIR` to a `packaged` subdirectory and rerun the shortcut and consumer scenarios. No host fonts, printers, or network connections are installed.

```powershell
node scripts/verify/polish-housekeeping.mjs
```

## Historical proofs

Files outside the current sets above have a `Historical proof` marker near their first line. These files preserve evidence from earlier rebuild rounds, including their helper modules and capture scripts. They may require an old branch, a dev renderer, a particular saved game, or the original proof directory. Their original usage notes remain in each file.

`polish-housekeeping.mjs` checks that every file is either in the current set above or explicitly marked historical. It also checks JavaScript syntax and rejects report or scratch filenames under `src`. `src/renderer/src/system/README.md` is maintained asset documentation and stays beside the system code.
