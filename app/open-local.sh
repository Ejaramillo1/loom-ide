#!/usr/bin/env bash
# Open the Loom IDE desktop app (Tauri) on this computer.
#
# This launches the real app. The browser preview (`npm run dev`) is NOT
# used here on purpose: in a plain browser the frontend shows local demo
# data (localStorage work items, empty collaboration/attention) instead of
# your real work, because the Tauri backend is not available there.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js (which includes npm), then try again."
  exit 1
fi
if ! command -v cargo >/dev/null 2>&1; then
  echo "Install the Rust toolchain (https://rustup.rs), then try again."
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi
echo "Opening the Loom IDE desktop app..."
echo "Keep this terminal open. Press Ctrl+C to stop it."
exec npm run tauri dev
