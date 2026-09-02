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
      // The /components catalogue gallery (#540): inline SSR thumbnails, the
      // wide band, the filter contract, and the tile-size control.
      name: "catalog-gallery",
      testMatch: "catalog-gallery.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "preview-token-panel",
      testMatch: "preview-token-panel.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "preview-fidelity",
      testMatch: "preview-fidelity.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      // #541 — the detail-page workbench (one toolbar, controlled stages).
      // Serves from the same root dist as the smoke project.
      name: "detail-workbench",
      testMatch: "detail-workbench.spec.ts",
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
