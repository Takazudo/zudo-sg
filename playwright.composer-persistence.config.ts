import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer } from "./scripts/lib/playwright-e2e-server.mjs";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const staticServer = createStaticPreviewServer({
  entry: "persistence",
  projectRoot: PROJECT_ROOT,
  distPath: "dist",
  buildCommand: "pnpm build",
  command: "pnpm exec zfb preview --port {port}",
  urlPath: "/composer/",
  timeout: 60_000,
});

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-persistence.json" }]]
    : "list",
  use: { baseURL: staticServer.origin },
  webServer: staticServer.webServer,
  projects: [
    { name: "composer-persistence", testMatch: "composer-persistence.spec.ts" },
    { name: "composer-production-boundary", testMatch: "composer-production-boundary.spec.ts" },
    { name: "composer-adapted", testMatch: "composer.spec.ts" },
  ],
});
