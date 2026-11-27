#!/usr/bin/env bash
# Installs Playwright's Chromium and its system packages on a CI runner
# (.github/workflows/ci.yml calls it for the visual jobs).
#
# GitHub's ubuntu-24.04 image ships an apt source for packages.microsoft.com.
# That host sometimes answers 403, `apt-get update` then exits 100, and
# `playwright install --with-deps` fails before any test runs (26 and 27 Nov
# 2026; a rerun always passed). The game uses no Microsoft package, so drop
# every apt source that points there, whatever its file is called (.list or
# deb822 .sources), and tolerate there being none.
set -euo pipefail

shopt -s nullglob
echo "apt sources: $(ls /etc/apt/sources.list.d 2>/dev/null | tr '\n' ' ')"
for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  if grep -qs "packages\.microsoft\.com" "$f"; then
    echo "Removing apt source $f (packages.microsoft.com)"
    sudo rm -f "$f"
  fi
done

# One retry for any other passing network hiccup.
npx playwright install --with-deps chromium || {
  echo "playwright install failed; retrying once in 15 s"
  sleep 15
  npx playwright install --with-deps chromium
}
