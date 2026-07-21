#!/usr/bin/env bash
# Epic #368 review finding 2 — "leaving the browser is not leaving the block".
#
# The suite runs HEADED on purpose: headless Chromium has no window to lose
# focus, so the bug it pins is invisible there (see the spec's header). That
# needs a display. On a Mac there already is one; on a headless Linux box or
# WSL there usually is not, so wrap the run in Xvfb when one is available.
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG=playwright.prose-window-blur.config.ts

if [ -n "${DISPLAY:-}" ]; then
  exec pnpm exec playwright test --config="$CONFIG" "$@"
fi

if command -v xvfb-run >/dev/null 2>&1; then
  exec xvfb-run -a --server-args="-screen 0 1600x1000x24" \
    pnpm exec playwright test --config="$CONFIG" "$@"
fi

echo "error: this suite needs a real browser window." >&2
echo "       Set DISPLAY, or install xvfb (apt-get install xvfb)." >&2
exit 1
