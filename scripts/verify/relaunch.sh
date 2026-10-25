#!/usr/bin/env bash
# Rebuilds, stops this worktree's Electron (matched by executable path, so other workers' apps are safe),
# and starts it again on CDP port $W95_CDP_PORT (default 9331) with data in $W95_DATA_DIR.
# Pass --fresh to wipe the data dir first.
set -e
cd "$(dirname "$0")/../.."
unset ELECTRON_RUN_AS_NODE
port="${W95_CDP_PORT:-9331}"
data="${W95_DATA_DIR:-D:/tmp/s2-data}"
exe="$(pwd -W 2>/dev/null || pwd)/node_modules/electron/dist/electron.exe"
pnpm build >/dev/null
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='electron.exe'\" | Where-Object { \$_.ExecutablePath -and (\$_.ExecutablePath -replace '\\\\','/') -ieq '${exe}' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
sleep 1
if [ "$1" = "--fresh" ]; then rm -rf "$data"; fi
mkdir -p "$data"
W95_CDP_PORT="$port" W95_DATA_DIR="$data" node_modules/electron/dist/electron.exe . >/dev/null 2>&1 &
for _ in $(seq 1 40); do
  if curl -s "http://127.0.0.1:${port}/json/list" | grep -q webSocketDebuggerUrl; then sleep 2; exit 0; fi
  sleep 0.5
done
echo "Electron did not open CDP on ${port}" >&2
exit 1
