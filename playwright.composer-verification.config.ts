import { defineConfig } from "@playwright/test";

const STATIC_PORT = 4704;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  preserveOutput: "always",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/composer-verification.json" }]]
    : "list",
  use: { baseURL: `http://localhost:${STATIC_PORT}` },
  webServer: {
    command: `pnpm exec zfb preview --port ${STATIC_PORT}`,
    url: `http://localhost:${STATIC_PORT}/composer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
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
