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
| T1 | Active | PR CI gate: lint-tokens + codegen-drift + typecheck + unit + build + build-demo + smoke-e2e + dist-checks + file-provider-e2e |
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
6. Build demo — `pnpm --filter @zudo-sg/demo build`
7. Link check — `pnpm check:links` + `pnpm check:links:demo`
8. HTML validation — `pnpm check:html`
9. Playwright smoke e2e — `pnpm test:e2e` (styleguide + the 6 composer projects +
   demo-smoke — see [Composer E2E suites](#composer-e2e-suites))
10. Manual interactive smoke (operator-driven)

### T1 — CI gate (authoritative)

The `pr-checks.yml` workflow runs on every PR targeting `main` or `base/**` and is
the single source of truth for pass/fail. Jobs mirror the b4push steps:

- **lint-tokens** — `pnpm lint:tokens` (no-op until S2)
- **codegen-drift** — `pnpm check:z-index` + `pnpm check:sg-registry` +
  `pnpm check:token-manifest`
- **typecheck** — `pnpm check`
- **unit** — `pnpm test:unit`
- **build** — `pnpm build` (produces and caches `dist/`)
- **build-demo** — `pnpm --filter @zudo-sg/demo build` (produces and caches
  `apps/demo/dist`), then `pnpm check:links:demo` against it
- **smoke-e2e** — `pnpm test:e2e:ci` (Playwright, Chromium only; styleguide +
  the 6 composer projects + demo-smoke — see
  [Composer E2E suites](#composer-e2e-suites); needs `build` and `build-demo`)
- **dist-checks** — `pnpm check:links` + `pnpm check:html` against `dist/`
  (needs `build`; merged into one job so both checks share a single install)
- **file-provider-e2e** — `pnpm test:e2e:composer-file` (Playwright, dev-server-backed
  file provider suite; no `needs`, builds its own `zfb dev` server from source — see
  [Composer E2E suites](#composer-e2e-suites))

### Individual checks

```bash
pnpm check              # typecheck
pnpm test:unit          # unit tests (vitest)
pnpm build              # build site → dist/
pnpm --filter @zudo-sg/demo build  # build demo site → apps/demo/dist/
pnpm check:links        # broken internal link check (needs dist/)
pnpm check:links:demo   # broken internal link check for the demo (needs apps/demo/dist/)
pnpm check:html         # HTML validation (needs dist/)
pnpm test:e2e           # Playwright smoke (needs dist/ and apps/demo/dist/)
```

### Composer E2E suites

`playwright.config.ts` (the default config, run by `pnpm test:e2e` / `pnpm test:e2e:ci`)
includes 6 composer projects alongside `smoke`, `preview-token-panel`, and `demo-smoke`.
The composer projects, like `smoke` and `preview-token-panel`, are served from the
styleguide's static `dist/` preview (port 4700) — `demo-smoke` is separate, served from
`apps/demo/dist` on port 4701:

| Project | Spec | Covers |
|---------|------|--------|
| `composer` | `composer.spec.ts` | 14-step editor walkthrough — canvas/tree edits, chooser, inline text edit, copy/paste/cut/duplicate, cross-slot drag, storage & recovery matrix, SPA navigation guard |
| `composer-persistence` | `composer-persistence.spec.ts` | Real-browser IndexedDB lifecycle (create/update/duplicate/delete) and legacy-storage migration |
| `composer-production-boundary` | `composer-production-boundary.spec.ts` | Built preview exposes IndexedDB but no dev file capability, endpoint, UI, or destination writes |
| `composer-contracts` | `composer-contracts.spec.ts` | Composer Polish S7 computed-style contract gate (panel separation, chooser dialog, tree geometry, accent census, typography floor, narrow-viewport overflow) |
| `composer-verification` | `composer-verification.spec.ts` | Viewport/theme/a11y matrix and interaction/state semantics (touch + mobile) |
| `composer-reuse` | `composer-reuse.spec.ts` | Global-template and Pattern reuse — publish, discover, insert, dependency-checked unpublish, detach flows (touch + mobile) |

Three composer-specific config files exist outside the default config, each with its own
server/port and script — `composer-file`'s script runs in CI (see below); the
`composer-verification` and `composer-persistence` scripts are local-only:

| Config | Port | Server | Projects | Script |
|--------|------|--------|----------|--------|
| `playwright.composer-file.config.ts` | 4702 | `zfb dev` (filesystem transport, via `scripts/run-composer-file-e2e-server.mjs`) | `composer-file-provider` | `pnpm test:e2e:composer-file` |
| `playwright.composer-verification.config.ts` | 4704 | `zfb preview` | `composer-verification`, `composer-contracts`, `composer-reuse` | `pnpm test:e2e:composer-verification` (all three); `pnpm test:e2e:composer-reuse` (just `composer-reuse`) |
| `playwright.composer-persistence.config.ts` | 4703 | `zfb preview` | `composer-persistence`, `composer-production-boundary`, `composer-adapted` (`composer.spec.ts`) | `pnpm test:e2e:composer-persistence` |

`playwright.composer-file.config.ts` is the only composer suite that can't run against a
static `dist/` preview — it needs `zfb dev`'s filesystem write transport, which is exactly
the surface `composer-production-boundary` asserts is absent from the built preview.

**CI vs local, precisely:**

- CI runs the reuse spec through the **default-config `composer-reuse` project**, inside
  the `smoke-e2e` job (`pnpm test:e2e:ci`) — it does **not** invoke
  `pnpm test:e2e:composer-reuse`. That isolated script (on
  `playwright.composer-verification.config.ts` @4704) is a local-only command.
- `composer-file` runs in its own `file-provider-e2e` CI job
  (`pnpm test:e2e:composer-file`), since it needs a live `zfb dev` server rather than a
  `dist/` preview.
- `pnpm test:e2e:composer-verification` and `pnpm test:e2e:composer-persistence` are not
  invoked by CI at all — they're local-only debugging entry points.

This is a **deliberate overlap**: `composer-persistence`, `composer-production-boundary`,
`composer` (as `composer-adapted`), `composer-verification`, `composer-contracts`, and
`composer-reuse` all exist both in the default config (parallel workers, one shared dist
server, run in CI) and in the isolated 4703/4704 configs (`workers: 1`, serial database
mutations, run locally) — the isolated configs give a deterministic, single-worker
environment for debugging persistence/reuse flakes without the noise of the full parallel
suite.

**E2E support modules** (not test files themselves):

- `e2e/support/composer-persistence.ts` — IndexedDB constants (database/store names, the
  legacy storage key, composer route paths) and fixture helpers for opening a persisted
  record.
- `e2e/support/composer-reuse.ts` — reuse document/node builders and constants
  (`SOURCE_RECORD_ID`, `PATTERN_RECORD_ID`) for Global-template and Pattern flows.

> The `pr-checks.yml` job comments (job list, ordering, `needs` wiring) are owned by the
> Composer CI epic — this section describes the resulting test surface, not the workflow
> file itself.

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
- **New E2E flows** → add `*.spec.ts` to `e2e/`. Styleguide flows go in the port-4700 smoke fixture; demo flows go in the port-4701 demo-smoke fixture (see `playwright.config.ts`). Composer flows default to a `composer*` project in `playwright.config.ts` (static `dist/` preview) — only reach for one of the composer-specific configs when the flow needs something the default config can't give it: filesystem-write/dev-transport coverage → `playwright.composer-file.config.ts`; an isolated, single-worker run for verification/contracts/reuse debugging → `playwright.composer-verification.config.ts`; the same for persistence/production-boundary/full-walkthrough debugging → `playwright.composer-persistence.config.ts`. See [Composer E2E suites](#composer-e2e-suites).
- **Visual regression** → use `/verify-ui` skill ad-hoc; do not add L5 specs to CI until T3 is set up.
