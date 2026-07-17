import { defineConfig } from "@playwright/test";

// Two smoke fixtures — each serves a pre-built dist/ output.
// Port 4700 is reserved for the styleguide host's smoke fixture, 4701 for the
// demo site's, to avoid collisions with zudo-doc fixtures (4500–4504) and the
// dev server (4321).
// Override these for an isolated worktree run. The defaults remain stable for
// local smoke workflows, while concurrent checkouts never accidentally reuse
// a preview server serving another checkout's dist output.
const SMOKE_PORT = Number(process.env.ZUDO_SG_SMOKE_PORT ?? 4700);
const DEMO_SMOKE_PORT = Number(process.env.ZUDO_SG_DEMO_SMOKE_PORT ?? 4701);

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/report.json" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${SMOKE_PORT}`,
  },
  // Note: all entries here start for every test run regardless of which
  // --project is selected (Playwright starts webServer globally, not
  // per-project) — so both dist/ and apps/demo/dist must exist before
  // running any project in this config.
  webServer: [
    {
      // Requires `pnpm build` to have run first (dist/ must exist).
      command: `pnpm exec zfb preview --port ${SMOKE_PORT}`,
      url: `http://localhost:${SMOKE_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Requires `pnpm --filter @zudo-sg/demo build` to have run first
      // (apps/demo/dist must exist).
      command: `pnpm --filter @zudo-sg/demo exec zfb preview --port ${DEMO_SMOKE_PORT}`,
      url: `http://localhost:${DEMO_SMOKE_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "preview-token-panel",
      testMatch: "preview-token-panel.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "composer",
      // /composer is built into the root dist/ — same static server as
      // "smoke" (SMOKE_PORT), not a separate webServer entry.
      testMatch: "composer.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "composer-persistence",
      // Real Chromium IndexedDB/migration lifecycle and provider-qualified
      // navigation. Kept separate from the long editor walkthrough so fixture
      // cleanup and serial database mutations remain explicit.
      testMatch: "composer-persistence.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "composer-production-boundary",
      // Static preview must never expose the dev file transport or provider.
      testMatch: "composer-production-boundary.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "composer-contracts",
      // Composer Polish epic (#262) S7 (#270) computed-style contract gate —
      // dual-mode census/measurement pass over the built /composer (SMOKE_PORT).
      testMatch: "composer-contracts.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
    {
      name: "composer-verification",
      // Final persistence-library matrix: deterministic width/theme/layout,
      // touch-target, keyboard-name/focus/live-region, state, and error gates.
      // Screenshots are attached as confirmation artifacts after assertions.
      testMatch: "composer-verification.spec.ts",
      use: {
        baseURL: `http://localhost:${SMOKE_PORT}`,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "composer-reuse",
      // IndexedDB-only composition reuse flows against the built /composer —
      // safe to ride the static preview server alongside the other composer
      // projects (no dev file transport involved).
      testMatch: "composer-reuse.spec.ts",
      use: {
        baseURL: `http://localhost:${SMOKE_PORT}`,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "demo-smoke",
      // Both demo specs serve from the same built demo dist (DEMO_SMOKE_PORT):
      // the render smoke checks, the SPA-transition regression suite, and the
      // complete refresh integration contracts.
      testMatch: ["demo-smoke.spec.ts", "demo-transition.spec.ts", "demo-refresh.spec.ts"],
      use: { baseURL: `http://localhost:${DEMO_SMOKE_PORT}` },
    },
  ],
});
