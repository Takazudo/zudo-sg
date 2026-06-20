# Testing Strategy

This document maps the [zudo-test-wisdom](https://github.com/Takazudo/zudo-test-wisdom)
framework onto this repo concretely. It is the authoritative reference for what to run,
when, and why.

---

## Archetype

**SSG-emitting-runtime + static docs, pre-release.**

zudo-sg is a documentation site built with zfb (a Vite/Preact SSG framework). The
generator side is CLI-shaped (T0–T1 sufficient); the emitted runtime (islands, client
router) is covered by T0 unit tests today, with L4 E2E coverage added in T1.

---

## Tiers in Use

| Tier | Status | What runs |
|------|--------|-----------|
| T0 | Active | typecheck + unit tests — inner loop, constant feedback |
| T1 | Active | PR CI gate: lint-tokens + typecheck + unit + build + smoke-e2e + link-check + html-validate |
| T2 | Not needed | T1 budget is well under 10 min; no split needed |
| T3 | Deferred to release | see below |
| T4 | Local b4push only | convenience pre-push pass (not enforcement) |

---

## Test Levels

| Level | What | Tools | Command |
|-------|------|-------|---------|
| L1 | Unit / logic | vitest | `pnpm test:unit` |
| L4 | E2E browser smoke | Playwright | `pnpm test:e2e` |
| L5 | Visual / computed-style | `/verify-ui` skill | ad-hoc, not in CI |

---

## Commands

### T0 — Inner loop (run constantly while implementing)

```bash
pnpm check        # TypeScript typecheck (zfb check)
pnpm test:unit    # vitest unit tests
```

### T1 — Local pre-push gate

```bash
pnpm b4push       # runs all steps below in order
```

Steps in `scripts/run-b4push.sh`:

1. Format check (mdx) — `pnpm dlx @takazudo/mdx-formatter --check .`
2. Design token lint — `pnpm lint:tokens` (owned by S2; no-op pass until S2 merges)
3. Type checking — `pnpm check`
4. Unit tests — `pnpm test:unit`
5. Build — `pnpm build`
6. Link check — `pnpm check:links`
7. HTML validation — `pnpm check:html`
8. Playwright smoke e2e — `pnpm test:e2e`
9. Manual interactive smoke (operator-driven)

### T1 — CI gate (authoritative)

The `pr-checks.yml` workflow runs on every PR targeting `main` or `base/**` and is
the single source of truth for pass/fail. Jobs mirror the b4push steps:

- **lint-tokens** — `pnpm lint:tokens` (no-op until S2)
- **typecheck** — `pnpm check`
- **unit** — `pnpm test:unit`
- **build** — `pnpm build` (produces and caches `dist/`)
- **smoke-e2e** — `pnpm test:e2e:ci` (Playwright, Chromium only)
- **link-check** — `pnpm check:links`
- **html-validate** — `pnpm check:html`

### Individual checks

```bash
pnpm check          # typecheck
pnpm test:unit      # unit tests (vitest)
pnpm build          # build site → dist/
pnpm check:links    # broken internal link check (needs dist/)
pnpm check:html     # HTML validation (needs dist/)
pnpm test:e2e       # Playwright smoke (needs dist/)
```

---

## Pre-commit Hook (lefthook)

`lefthook.yml` installs a `pre-commit` hook that auto-formats staged `.md` / `.mdx`
files with `@takazudo/mdx-formatter`. The hook is installed automatically on
`pnpm install` via the `prepare` script.

---

## T3 Deferral — Scheduled Re-exam

**T3 (scheduled rich CI) is deferred until release.** This is a deliberate, time-boxed
decision per the test-wisdom execution-tiers guide:

> For a project that has not yet shipped to users, T3 can be deferred. Standing up T3
> early is not cost-justified: hosted-macOS Actions minutes and self-hosted GPU runners
> cost real money for a project nobody uses yet.

For zudo-sg specifically:

- No `exam.yml` nightly workflow is scaffolded.
- No GPU/macOS/WebKit CI lanes.
- Visual regression (L5) and platform-specific keyboard tests run ad-hoc via `/verify-ui`
  and `/headless-browser` skills, not as scheduled CI jobs.

**Adopt T3 at or after first public release**, when the project has users whose
regressions justify the standing infrastructure cost. At that point:

- Add `exam.yml` with a nightly cron trigger.
- Add a macOS runner lane for WebKit / platform-specific tests.
- Wire `scripts/file-exam-issue.sh` for deduplicated failure issue filing.

See [Scheduled Re-exam and Night Exam](https://github.com/Takazudo/zudo-test-wisdom)
for the concrete T3 implementation pattern.

---

## Allowlists

| File | Purpose |
|------|---------|
| `.check-links-allowlist` | Known broken internal links to suppress in `check:links` |
| `.htmlvalidate.json` | html-validate rule configuration |

---

## Adding Tests

- **Logic / data transforms** → add to `src/**/__tests__/` as `*.test.ts`, picked up by vitest automatically.
- **New E2E flows** → add `*.spec.ts` to `e2e/`. Keep them in the smoke fixture (single port 4700 server).
- **Visual regression** → use `/verify-ui` skill ad-hoc; do not add L5 specs to CI until T3 is set up.
