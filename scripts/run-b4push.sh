#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Design token lint (lint:tokens)
#   3. Codegen drift check (check:z-index, check:sg-registry)
#   4. Type checking (zfb check / tsc --noEmit)
#   5. Unit tests (test:unit)
#   6. Build (zfb build)
#   7. Build demo (apps/demo — needed by check:links:demo and the demo-smoke e2e project)
#   8. Link check (check:links + check:links:demo)
#   9. HTML validation (check:html)
#   10. Playwright smoke e2e (test:e2e — styleguide + demo-smoke projects)
#   11. Manual interactive smoke (operator-driven; auto-skipped when stdin is
#       not a TTY, e.g. CI or agent-driven runs)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 9)
#   B4PUSH_SKIP_E2E=1            — skip Playwright smoke (step 10)
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — force-skip the manual interactive smoke
#                                  (step 11) even in an interactive shell

START_TIME=$(date +%s)
FAILURES=()

# Single source of truth for step names — TOTAL_STEPS and each step's label
# are derived from this list instead of a hand-maintained counter, so adding
# or removing a step never needs a second edit to stay in sync.
STEPS=(
  "Format check (mdx)"
  "Design token lint (lint:tokens)"
  "Codegen drift check (check:z-index, check:sg-registry)"
  "Type checking (zfb check)"
  "Unit tests (test:unit)"
  "Build (zfb build)"
  "Build demo (apps/demo)"
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

# ── Step 3: Codegen drift check ───────────────────────
# Verifies generated files are in sync with their source of truth: the z-index
# block in src/styles/global.css (from src/config/z-index-tokens.ts) and the
# story registry (from packages/ui/src/*/*.stories.tsx). Catches a hand-edited
# generated block or a forgotten `pnpm gen:*` re-run before it reaches CI.
step
if (cd "$ROOT_DIR" && pnpm run check:z-index && pnpm run check:sg-registry); then
  pass "Codegen drift check passed"
else
  fail "Codegen drift check"
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

# ── Step 7: Build demo ────────────────────────────────
# apps/demo/dist is needed by check:links:demo (step 8) and by the demo-smoke
# Playwright project (step 10's webServer).
step
if (cd "$ROOT_DIR" && pnpm --filter @zudo-sg/demo build); then
  pass "Build demo passed"
else
  fail "Build demo"
fi

# ── Step 8: Link check ────────────────────────────────
step
if (cd "$ROOT_DIR" && pnpm check:links && pnpm check:links:demo); then
  pass "Link check passed"
else
  fail "Link check"
fi

# ── Step 9: HTML validation ───────────────────────────
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

# ── Step 10: Playwright smoke e2e ─────────────────────
# Runs the styleguide + demo smoke fixtures against the pre-built dist/ and
# apps/demo/dist to verify both sites render and have no console errors.
# Excluded from CI b4push (CI runs E2E in the pr-checks smoke-e2e job instead)
# but included in local b4push for fast pre-push confidence.
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

# ── Step 11: Manual interactive smoke ─────────────────
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
