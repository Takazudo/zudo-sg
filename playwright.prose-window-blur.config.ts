import { defineConfig } from "@playwright/test";

// Epic #368 review finding 2: "leaving the browser is not leaving the block".
//
// Its own config because the default harness CANNOT reproduce the bug — see
// e2e/composer-prose-window-blur.spec.ts's header. The one thing that lives
// here rather than in the spec is `headless: false`: headless Chromium has no
// window to lose focus, so the suite needs a real one. On a machine with no
// display, run it under xvfb-run (`pnpm test:e2e:prose-window-blur` does).
//
// Port 4713 keeps this off the smoke config's 4700/4701 so it can run beside
// a `pnpm test:e2e` without either run reusing the other's preview server.
const STATIC_PORT = 4713;

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${STATIC_PORT}`,
    headless: false,
  },
  webServer: {
    // Requires `pnpm build` to have run first (dist/ must exist).
    command: `pnpm exec zfb preview --port ${STATIC_PORT}`,
    url: `http://localhost:${STATIC_PORT}/composer/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "prose-window-blur",
      testMatch: "composer-prose-window-blur.spec.ts",
    },
  ],
});
