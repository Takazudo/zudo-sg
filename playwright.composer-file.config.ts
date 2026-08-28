import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDevServer } from "./scripts/lib/playwright-e2e-server.mjs";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const devServer = createDevServer({
  entry: "file-dev",
  projectRoot: PROJECT_ROOT,
  command: "node scripts/run-composer-file-e2e-server.mjs --port {port}",
  urlPath: "/composer/",
  timeout: 120_000,
});

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-file.json" }]]
    : "list",
  use: { baseURL: devServer.origin },
  webServer: devServer.webServer,
  projects: [{ name: "composer-file-provider", testMatch: "composer-file-provider.spec.ts" }],
});
