#!/usr/bin/env bash
# Double-click in Finder to start the local interface and open it in your browser.
cd "$(dirname "$0")/.." || exit 1
if [ ! -d .venv ]; then
  osascript -e 'display alert "Run scripts/setup_macos.sh first (in Terminal)."' >/dev/null; exit 1
fi
source .venv/bin/activate
( sleep 2; open "http://127.0.0.1:8765" ) &
exec tfd serve --port 8765
