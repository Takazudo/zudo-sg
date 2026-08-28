import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer } from "./scripts/lib/playwright-e2e-server.mjs";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const staticServer = createStaticPreviewServer({
  entry: "verification",
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
  preserveOutput: "always",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-verification.json" }]]
    : "list",
  use: { baseURL: staticServer.origin },
  webServer: staticServer.webServer,
  projects: [
    {
      name: "composer-verification",
      testMatch: "composer-verification.spec.ts",
      use: { hasTouch: true, isMobile: true },
    },
    {
      name: "composer-contracts",
      testMatch: "composer-contracts.spec.ts",
    },
    {
      name: "composer-reuse",
      testMatch: "composer-reuse.spec.ts",
      use: { hasTouch: true, isMobile: true },
    },
  ],
});
