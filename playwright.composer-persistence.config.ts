import { defineConfig } from "@playwright/test";

const STATIC_PORT = 4703;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-persistence.json" }]]
    : "list",
  use: { baseURL: `http://localhost:${STATIC_PORT}` },
  webServer: {
    command: `pnpm exec zfb preview --port ${STATIC_PORT}`,
    url: `http://localhost:${STATIC_PORT}/composer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "composer-persistence", testMatch: "composer-persistence.spec.ts" },
    { name: "composer-production-boundary", testMatch: "composer-production-boundary.spec.ts" },
    { name: "composer-adapted", testMatch: "composer.spec.ts" },
  ],
});
