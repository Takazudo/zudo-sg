import { defineConfig } from "@playwright/test";

const DEV_FILE_PORT = 4702;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-file.json" }]]
    : "list",
  use: { baseURL: `http://localhost:${DEV_FILE_PORT}` },
  webServer: {
    command: `node scripts/run-composer-file-e2e-server.mjs --port ${DEV_FILE_PORT}`,
    url: `http://localhost:${DEV_FILE_PORT}/composer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "composer-file-provider", testMatch: "composer-file-provider.spec.ts" }],
});
