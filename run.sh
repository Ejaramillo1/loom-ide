#!/usr/bin/env bash
# Build the Loom front end, then open it.
# Cargo checks for code changes, so this always opens the latest build.
set -e
cd "$(dirname "$0")"
echo "Building the Loom front end..."
cargo build
echo "Opening the Loom front end..."
exec ./target/debug/loom-frontend
