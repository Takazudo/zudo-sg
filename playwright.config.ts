import { defineConfig } from "@playwright/test";

// Single smoke fixture — serves the pre-built dist/ from the repo root.
// Port 4700 is reserved for this project's smoke fixture to avoid collisions
// with zudo-doc fixtures (4500–4504) and the dev server (4321).
const SMOKE_PORT = 4700;

export default defineConfig({
  testDir: "./e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "playwright-report/report.json" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${SMOKE_PORT}`,
  },
  webServer: {
    // Requires `pnpm build` to have run first (dist/ must exist).
    command: `pnpm exec zfb preview --port ${SMOKE_PORT}`,
    url: `http://localhost:${SMOKE_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { baseURL: `http://localhost:${SMOKE_PORT}` },
    },
  ],
});
