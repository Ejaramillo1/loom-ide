#!/usr/bin/env bash
# Open the current Loom web app on this computer.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js (which includes npm), then try again."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
echo "Opening Loom at http://localhost:1420"
echo "Keep this terminal open. Press Ctrl+C to stop Loom."
exec npm run dev -- --host 127.0.0.1 --open
