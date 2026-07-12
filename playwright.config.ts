import { defineConfig } from "@playwright/test";

// Two smoke fixtures — each serves a pre-built dist/ output.
// Port 4700 is reserved for the styleguide host's smoke fixture, 4701 for the
// demo site's, to avoid collisions with zudo-doc fixtures (4500–4504) and the
// dev server (4321).
const SMOKE_PORT = 4700;
const DEMO_SMOKE_PORT = 4701;

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
      name: "demo-smoke",
      // Both demo specs serve from the same built demo dist (DEMO_SMOKE_PORT):
      // the render smoke checks and the SPA-transition regression suite.
      testMatch: ["demo-smoke.spec.ts", "demo-transition.spec.ts"],
      use: { baseURL: `http://localhost:${DEMO_SMOKE_PORT}` },
    },
  ],
});
