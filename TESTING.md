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
| T1 | Active | PR CI gate: lint-tokens + codegen/provider drift + typecheck + unit + provider conformance + root/demo/doc builds + smoke-e2e + dist-checks |
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
2. Design token lint — `pnpm lint:tokens`
3. Codegen/provider drift checks — all `check:*` generators plus the UI provider boundary
4. Type checking — `pnpm check`
5. Unit tests — `pnpm test:unit`
6. Root build — `pnpm build`
7. Demo build — `pnpm --filter @zudo-sg/demo build`
8. Documentation build — `pnpm build:doc`
9. Link checks — root, demo, and documentation output
10. HTML validation — `pnpm check:html`
11. Playwright smoke e2e — `pnpm test:e2e` (`smoke`, `preview-token-panel`, and `demo-smoke`)
12. Manual interactive smoke (operator-driven)

### T1 — CI gate (authoritative)

The `pr-checks.yml` workflow runs on every PR targeting `main` or `base/**` and is
the single source of truth for pass/fail. Jobs mirror the b4push steps:

- **lint-tokens** — `pnpm lint:tokens`
- **codegen-drift** — z-index, story registry/category, Composer provider pack,
  provider boundary, and UI/root token-manifest drift checks
- **typecheck** — `pnpm check`
- **unit** — `pnpm test:unit`
- **provider-conformance** — standalone UI package checks and exact provider install
- **build** — `pnpm build` (produces and caches `dist/`)
- **build-demo** — `pnpm --filter @zudo-sg/demo build` (produces and caches
  `apps/demo/dist`), then `pnpm check:links:demo` against it
- **build-doc** — `pnpm build:doc`, then `pnpm check:links:doc`
- **smoke-e2e** — `pnpm test:e2e:ci` (Playwright, Chromium only; `smoke`,
  `preview-token-panel`, and `demo-smoke`; needs `build` and `build-demo`)
- **dist-checks** — `pnpm check:links` + `pnpm check:html` against `dist/`
  (needs `build`; merged into one job so both checks share a single install)

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

### Worktree E2E isolation

The Playwright server contract is checkout-scoped. Every server command is given the
checkout root as its `cwd`, and every generated `webServer` entry sets
`reuseExistingServer: false`. A server that happens to answer the configured URL is
therefore never silently adopted: Playwright must start the command owned by this
checkout, and an occupied target port fails server startup before any test can pass.

The default `playwright.config.ts` owns two static-preview servers. Both use
`zfb preview` and require build output from this checkout: the root server
serves `dist/`, and the demo server serves `apps/demo/dist/`.

#### Port selection

The helper in `scripts/lib/playwright-e2e-server.mjs` resolves one port per server
entry. The two entries, their explicit overrides, CI fallbacks, and local offsets are:

| Entry / surface | Override environment variable | CI fallback | Local offset |
|-----------------|------------------------------|-------------|--------------|
| Root static preview (`playwright.config.ts`) | `ZUDO_SG_SMOKE_PORT` | 4700 | 0 |
| Demo static preview (`playwright.config.ts`) | `ZUDO_SG_DEMO_SMOKE_PORT` | 4701 | 1 |

On a non-CI run without an override, the helper hashes
`fs.realpathSync(checkoutRoot)` with SHA-256, maps the first 32-bit word into one of
2,000 buckets, and assigns a 16-port block starting at `20000 + bucket * 16`. The
entry's local offset above selects its port in that block. This keeps ordinary
worktrees apart while preserving a deterministic port for each checkout. A hash
collision is still possible; because ownership is exclusive, it fails loudly rather
than serving a different checkout, and an explicit override can resolve it.

An override wins in both local and CI environments. Override values must be decimal
integers from 1 through 65,535; invalid values fail during config evaluation.

#### Build prerequisites and commands

Install dependencies and build both static outputs before running Playwright:

```bash
cd /path/to/zudo-sg-worktree
pnpm install                         # once per worktree

pnpm build
pnpm --filter @zudo-sg/demo build
pnpm test:e2e                        # or: pnpm test:e2e:ci
```

The default config evaluates both `createStaticPreviewServer` calls before
Playwright applies a project filter. If `dist/` is absent, evaluation stops with the
absolute root path and:

```text
[e2e server isolation] Missing static build output: <checkout>/dist
Run `pnpm build` in this checkout before Playwright.
Refusing to attach to any existing server because this run must test this checkout's build.
```

After the root output exists, an absent `apps/demo/dist/` produces the corresponding
demo message and instructs `pnpm --filter @zudo-sg/demo build`. A file at either path
instead of a directory reports `Static build output is not a directory` with the same
checkout-specific build instruction. These checks happen before Playwright can probe
or reuse any URL, so a missing root and a missing demo output are separate failures
to test.

To run in parallel with another checkout, force known, separate target ports. The
override must be applied to the command that loads the matching config:

```bash
ZUDO_SG_SMOKE_PORT=54320 ZUDO_SG_DEMO_SMOKE_PORT=54321 pnpm test:e2e
```

The static command requires both builds listed above and no foreign process on
either target port. The three current projects are:

| Project | Specs | Surface |
|---------|-------|---------|
| `smoke` | `smoke.spec.ts` | Root styleguide, component catalog, and preview iframe |
| `preview-token-panel` | `preview-token-panel.spec.ts` | Preview-token panel and iframe isolation |
| `demo-smoke` | `demo-smoke.spec.ts`, `demo-transition.spec.ts`, `demo-refresh.spec.ts` | Demo rendering, navigation transitions, and refresh integration |

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
- **New E2E flows** → add `*.spec.ts` to `e2e/`. Styleguide flows belong in `smoke` or `preview-token-panel` (root preview, CI fallback 4700); demo flows belong in `demo-smoke` (demo preview, CI fallback 4701). Keep new product-specific Composer/Sitemapper tests in the standalone zudo-composer repository.
- **Visual regression** → use `/verify-ui` skill ad-hoc; do not add L5 specs to CI until T3 is set up.
- **Anything asserting DOMPurify output** → put `@vitest-environment jsdom` in the file's leading docblock. Under the repo-wide happy-dom environment (16.8.1) DOMPurify reports `isSupported: true` yet sanitizes nothing — `<script>` and `onerror=` pass through verbatim — so an XSS assertion there would be testing a sanitizer that never ran. `packages/ui/src/content/prose-md/markdown-runtime.ts` refuses such a DOM outright (it probes the sanitizer before trusting it) and returns `html: null` with a `sanitize` error diagnostic, so the symptom is a null result rather than unsafe HTML.
