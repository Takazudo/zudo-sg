import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer } from "./scripts/lib/playwright-e2e-server.mjs";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const smokeServer = createStaticPreviewServer({
  entry: "root",
  projectRoot: PROJECT_ROOT,
  distPath: "dist",
  buildCommand: "pnpm build",
  command: "pnpm exec zfb preview --port {port}",
  urlPath: "/",
  timeout: 60_000,
});
const demoSmokeServer = createStaticPreviewServer({
  entry: "demo",
  projectRoot: PROJECT_ROOT,
  distPath: "apps/demo/dist",
  buildCommand: "pnpm --filter @zudo-sg/demo build",
  command: "pnpm --filter @zudo-sg/demo exec zfb preview --port {port}",
  urlPath: "/",
  timeout: 60_000,
});

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/report.json" }]]
    : "list",
  use: {
    baseURL: smokeServer.origin,
  },
  // Note: all entries here start for every test run regardless of which
  // --project is selected (Playwright starts webServer globally, not
  // per-project) — so both dist/ and apps/demo/dist must exist before
  // running any project in this config.
  webServer: [smokeServer.webServer, demoSmokeServer.webServer],
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "preview-token-panel",
      testMatch: "preview-token-panel.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer",
      // /composer is built into the root dist/ — same static server as
      // "smoke" (SMOKE_PORT), not a separate webServer entry.
      testMatch: "composer.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer-prose",
      // Epic #368's explicit-save prose flow, plus the proof that the hashed
      // wasm markdown runtime really loads from the BUILT site (#376). Same
      // static dist/ preview as "composer".
      testMatch: "composer-prose.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer-persistence",
      // Real Chromium IndexedDB/migration lifecycle and provider-qualified
      // navigation. Kept separate from the long editor walkthrough so fixture
      // cleanup and serial database mutations remain explicit.
      testMatch: "composer-persistence.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer-production-boundary",
      // Static preview must never expose the dev file transport or provider.
      testMatch: "composer-production-boundary.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer-contracts",
      // Composer Polish epic (#262) S7 (#270) computed-style contract gate —
      // dual-mode census/measurement pass over the built /composer (SMOKE_PORT).
      testMatch: "composer-contracts.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "composer-verification",
      // Final persistence-library matrix: deterministic width/theme/layout,
      // touch-target, keyboard-name/focus/live-region, state, and error gates.
      // Screenshots are attached as confirmation artifacts after assertions.
      testMatch: "composer-verification.spec.ts",
      use: {
        baseURL: smokeServer.origin,
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
        baseURL: smokeServer.origin,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "sitemapper",
      // Full IndexedDB user story plus the 1440/375 light/dark rendered
      // contract. It shares the built styleguide preview with Composer so a
      // single browser origin can exercise cross-feature references.
      testMatch: "sitemapper.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "demo-smoke",
      // Both demo specs serve from the same built demo dist (DEMO_SMOKE_PORT):
      // the render smoke checks, the SPA-transition regression suite, and the
      // complete refresh integration contracts.
      testMatch: ["demo-smoke.spec.ts", "demo-transition.spec.ts", "demo-refresh.spec.ts"],
      use: { baseURL: demoSmokeServer.origin },
    },
  ],
});
