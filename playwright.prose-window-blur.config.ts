import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer } from "./scripts/lib/playwright-e2e-server.mjs";

// Epic #368 review finding 2: "leaving the browser is not leaving the block".
//
// Its own config because the default harness CANNOT reproduce the bug — see
// e2e/composer-prose-window-blur.spec.ts's header. The one thing that lives
// here rather than in the spec is `headless: false`: headless Chromium has no
// window to lose focus, so the suite needs a real one. On a machine with no
// display, run it under xvfb-run (`pnpm test:e2e:prose-window-blur` does).

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const staticServer = createStaticPreviewServer({
  entry: "prose-window-blur",
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
  reporter: "list",
  use: {
    baseURL: staticServer.origin,
    headless: false,
  },
  webServer: staticServer.webServer,
  projects: [
    {
      name: "prose-window-blur",
      testMatch: "composer-prose-window-blur.spec.ts",
    },
  ],
});
