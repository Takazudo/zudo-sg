#!/usr/bin/env bash
set -euo pipefail

# b4push — local quality gate run before pushing.
#
# Step order (cheap → expensive):
#   1. Format check (mdx)
#   2. Design token lint (lint:tokens — owned by S2; no-op pass when absent)
#   3. Token manifest drift check (check:token-manifest)
#   4. Type checking (zfb check / tsc --noEmit)
#   5. Unit tests (test:unit)
#   6. Build (zfb build)
#   7. Link check (check:links)
#   8. HTML validation (check:html)
#   9. Playwright smoke e2e (test:e2e)
#  10. Manual interactive smoke (operator-driven)
#
# Env overrides for non-interactive use:
#   B4PUSH_SKIP_HTML_VALIDATE=1  — skip HTML validation (step 8)
#   B4PUSH_SKIP_E2E=1            — skip Playwright smoke (step 9)
#   B4PUSH_SKIP_MANUAL_SMOKE=1   — skip the manual interactive smoke (step 10)

START_TIME=$(date +%s)
FAILURES=()
TOTAL_STEPS=10
CURRENT_STEP=0

step() {
  CURRENT_STEP=$((CURRENT_STEP + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ Step $CURRENT_STEP/$TOTAL_STEPS: $1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; FAILURES+=("$1"); }
skip() { echo "⏭  $1 (skipped)"; }

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Step 1: Format check (mdx) ────────────────────────
# Verify MDX/markdown files are formatted. The lefthook pre-commit hook
# auto-formats on commit; this step catches drifts from direct edits.
step "Format check (mdx)"
if (cd "$ROOT_DIR" && pnpm dlx @takazudo/mdx-formatter --check .); then
  pass "Format check passed"
else
  fail "Format check"
fi

# ── Step 2: Design token lint ─────────────────────────
# lint:tokens is owned by S2. On the bare scaffold (before S2 merges) this
# script may not exist yet. Degrade gracefully: pass if absent, enforce once
# S2 lands and adds the script + token files.
step "Design token lint (lint:tokens)"
LINT_TOKENS_OUTPUT="$(cd "$ROOT_DIR" && pnpm run lint:tokens 2>&1)" && LINT_TOKENS_EXIT=0 || LINT_TOKENS_EXIT=$?
if [ "$LINT_TOKENS_EXIT" -eq 0 ]; then
  pass "Design token lint passed"
elif echo "$LINT_TOKENS_OUTPUT" | grep -q "Missing script: lint:tokens\|Command not found: lint:tokens\|is not defined"; then
  skip "lint:tokens script not yet present (S2 pending) — OK on bare scaffold"
else
  echo "$LINT_TOKENS_OUTPUT"
  fail "Design token lint"
fi

# ── Step 3: Token manifest drift check ────────────────
# src/config/ui-design-tokens-manifest.ts is generated from
# packages/ui/styles/{tokens,colors}.css by scripts/gen-token-manifest.mjs.
step "Token manifest drift check (check:token-manifest)"
if (cd "$ROOT_DIR" && pnpm run check:token-manifest); then
  pass "Token manifest drift check passed"
else
  fail "Token manifest drift check"
fi

# ── Step 4: Type checking ─────────────────────────────
step "Type checking (zfb check)"
if (cd "$ROOT_DIR" && pnpm check); then
  pass "Type checking passed"
elif (cd "$ROOT_DIR" && pnpm exec tsc --noEmit); then
  pass "Type checking passed (tsc --noEmit fallback)"
else
  fail "Type checking"
fi

# ── Step 5: Unit tests ────────────────────────────────
step "Unit tests (test:unit)"
if (cd "$ROOT_DIR" && pnpm test:unit); then
  pass "Unit tests passed"
else
  fail "Unit tests"
fi

# ── Step 6: Build ─────────────────────────────────────
step "Build (zfb build)"
if (cd "$ROOT_DIR" && pnpm build); then
  pass "Build passed"
else
  fail "Build"
fi

# ── Step 7: Link check ────────────────────────────────
step "Link check (check:links)"
if (cd "$ROOT_DIR" && pnpm check:links); then
  pass "Link check passed"
else
  fail "Link check"
fi

# ── Step 8: HTML validation ───────────────────────────
step "HTML validation (html-validate)"
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
step "Playwright smoke e2e (test:e2e)"
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
step "Manual interactive smoke"
if [[ "${B4PUSH_SKIP_MANUAL_SMOKE:-}" == "1" ]]; then
  skip "Manual smoke (B4PUSH_SKIP_MANUAL_SMOKE=1)"
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
