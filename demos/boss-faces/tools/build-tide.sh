#!/bin/sh
# Bundle the game's Tidewyrm rig for the demo (needs the repo's node_modules).
cd "$(dirname "$0")/.." && npx esbuild tools/tide-entry.ts --bundle --format=iife --global-name=TIDE --outfile=src/tide-rig.js --log-level=warning
