#!/bin/sh
# Usage: scripts/verify/cardart-shot.sh <sheet name> <width> <height>
# Rebuilds the sheets from cards.ts and screenshots one with headless Chrome into the proof dir.
set -e
out=D:/codes/worktrees/windows-95-web/proof/cardart
node scripts/verify/cardart.mjs "$out" >/dev/null
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars \
  --window-size="$2,$3" --screenshot="$out/$1.png" --user-data-dir="$TEMP/cardart-chrome" \
  "file:///$out/sheet-$1.html" 2>/dev/null
echo "$out/$1.png"
