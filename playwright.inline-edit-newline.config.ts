import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer } from "./scripts/lib/playwright-e2e-server.mjs";

// Issue #444's manager-owned run is deliberately separate from the default
// suite. Build first, then run all four explicit projects against /composer:
//
//   pnpm build
//   pnpm test:e2e:inline-edit-newline
//   INLINE_EDIT_NEWLINE_ASSERT=1 pnpm test:e2e:inline-edit-newline
//
// `measure` is the pre-fix, green data-collection mode. #447 enables
// `confirm` on the same projects after the production fix; every row then has
// to equal its expected value. The attached JSON payload in each project and
// the reporter JSON include innerHTML/textContent snapshots.

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const staticServer = createStaticPreviewServer({
  entry: "root",
  projectRoot: PROJECT_ROOT,
  distPath: "dist",
  buildCommand: "pnpm build",
  command: "pnpm exec zfb preview --port {port}",
  urlPath: "/composer/",
  timeout: 60_000,
});

const reportOutput =
  process.env.ZUDO_SG_INLINE_EDIT_NEWLINE_REPORT ?? "playwright-report/inline-edit-newline.json";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  // The probe intentionally opens fourteen fresh contexts; individual
  // actions retain their normal Playwright timeouts while this test-level
  // bound allows all built Composer/wasm lifecycles to complete.
  timeout: 600_000,
  preserveOutput: "always",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: reportOutput }]],
  use: { baseURL: staticServer.origin },
  webServer: staticServer.webServer,
  projects: [
    {
      name: "chromium-plaintext-only",
      testMatch: "inline-edit-newline-probe.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "chromium-true",
      testMatch: "inline-edit-newline-probe.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "firefox-plaintext-only",
      testMatch: "inline-edit-newline-probe.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "firefox-true",
      testMatch: "inline-edit-newline-probe.spec.ts",
      // This intentionally forces the current Firefox fallback attribute
      // after the editor opens; it is not a claim about Firefox versions
      // before plaintext-only support landed.
      use: { browserName: "firefox" },
    },
  ],
});
