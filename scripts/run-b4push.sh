#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Design token lint (lint:tokens)
#   3. Z-index generated block check (check:z-index)
#   4. Type checking (zfb check / tsc --noEmit)
#   5. Unit tests (test:unit)
#   6. Build (zfb build)
#   7. Link check (check:links)
#   8. HTML validation (check:html)
#   9. Playwright smoke e2e (test:e2e)
#   10. Manual interactive smoke (operator-driven; auto-skipped when stdin is
#       not a TTY, e.g. CI or agent-driven runs)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 8)
#   B4PUSH_SKIP_E2E=1            — skip Playwright smoke (step 9)
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — force-skip the manual interactive smoke
#                                  (step 10) even in an interactive shell

START_TIME=$(date +%s)
FAILURES=()

# Single source of truth for step names — TOTAL_STEPS and each step's label
# are derived from this list instead of a hand-maintained counter, so adding
# or removing a step never needs a second edit to stay in sync.
STEPS=(
  "Format check (mdx)"
  "Design token lint (lint:tokens)"
  "Z-index generated block check (check:z-index)"
  "Type checking (zfb check)"
  "Unit tests (test:unit)"
  "Build (zfb build)"
  "Link check (check:links)"
  "HTML validation (html-validate)"
  "Playwright smoke e2e (test:e2e)"
  "Manual interactive smoke"
)
TOTAL_STEPS=${#STEPS[@]}
CURRENT_STEP=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Step $CURRENT_STEP/$TOTAL_STEPS: ${STEPS[$((CURRENT_STEP - 1))]}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAILURES+=("$1"); }
skip() { echo "⏭  $1 (skipped)"; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: Format check (mdx) ────────────────────────
# Verify MDX/markdown files are formatted. The lefthook pre-commit hook
# auto-formats on commit; this step catches drifts from direct edits.
step
if (cd "$ROOT_DIR" && pnpm dlx @takazudo/mdx-formatter --check .); then
  pass "Format check passed"
else
  fail "Format check"
fi

# ── Step 2: Design token lint ─────────────────────────
step
if (cd "$ROOT_DIR" && pnpm run lint:tokens); then
  pass "Design token lint passed"
else
  fail "Design token lint"
fi

# ── Step 3: Z-index generated block check ─────────────
# Catches hand-edits to the generated block in src/styles/global.css that
# have drifted from src/config/z-index-tokens.ts (the source of truth).
step
if (cd "$ROOT_DIR" && pnpm run check:z-index); then
  pass "Z-index generated block check passed"
else
  fail "Z-index generated block check"
fi

# ── Step 4: Type checking ─────────────────────────────
# No bare-tsc fallback here: `pnpm check` is a chain (root zfb check + ui
# typecheck + demo typecheck) and a root-only `tsc --noEmit` would silently
# mask a ui/demo-only failure, since the root tsconfig excludes both.
step
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed"
else
  fail "Type checking"
fi

# ── Step 5: Unit tests ────────────────────────────────
step
if (cd "$ROOT_DIR" && pnpm test:unit); then
  pass "Unit tests passed"
else
  fail "Unit tests"
fi

# ── Step 6: Build ─────────────────────────────────────
step
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 7: Link check ────────────────────────────────
step
if (cd "$ROOT_DIR" && pnpm check:links); then
  pass "Link check passed"
else
  fail "Link check"
fi

# ── Step 8: HTML validation ───────────────────────────
step
if [[ "${B4PUSH_SKIP_HTML_VALIDATE:-}" == "1" ]]; then
  skip "HTML validation (B4PUSH_SKIP_HTML_VALIDATE=1)"
else
  if (cd "$ROOT_DIR" && pnpm check:html); then
    pass "HTML validation passed"
  else
    fail "HTML validation"
  fi
fi

# ── Step 9: Playwright smoke e2e ──────────────────────
# Runs a single smoke fixture against the pre-built dist/ to verify the built
# site renders and has no console errors. Excluded from CI b4push (CI runs E2E
# in the pr-checks e2e job instead) but included in local b4push for fast
# pre-push confidence.
step
if [[ "${B4PUSH_SKIP_E2E:-}" == "1" ]]; then
  skip "Playwright smoke (B4PUSH_SKIP_E2E=1)"
else
  if (cd "$ROOT_DIR" && pnpm test:e2e); then
    pass "Playwright smoke passed"
  else
    fail "Playwright smoke e2e"
  fi
fi

# ── Step 10: Manual interactive smoke ─────────────────
# Auto-skipped when stdin is not a TTY (CI, agent-driven runs, `... | bash`)
# so b4push never blocks on a prompt nobody can answer.
step
if [[ "${B4PUSH_SKIP_MANUAL_SMOKE:-}" == "1" ]]; then
  skip "Manual smoke (B4PUSH_SKIP_MANUAL_SMOKE=1)"
elif [ ! -t 0 ]; then
  skip "Manual smoke (non-interactive, no TTY on stdin)"
else
  cat <<'MANUAL'
Run `pnpm preview` in another terminal and exercise:
  • home page renders
  • docs navigation works
  • search dropdown (if enabled)
  • dark/light theme toggle (if enabled)

Press [Enter] when all flows look healthy, or Ctrl-C to abort.
MANUAL
  if read -r _; then
    pass "Manual smoke acknowledged"
  else
    fail "Manual smoke (aborted)"
  fi
fi

# ── Summary ───────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SUMMARY (${DURATION}s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ All $TOTAL_STEPS checks passed (or skipped). Safe to push."
  exit 0
else
  echo "❌ ${#FAILURES[@]} check(s) failed:"
  for f in "${FAILURES[@]}"; do
    echo "   - $f"
  done
  exit 1
fi
