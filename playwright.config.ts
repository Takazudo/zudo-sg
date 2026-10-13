import { defineConfig } from "@playwright/test";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticPreviewServer, resolveE2EHost } from "./scripts/lib/playwright-e2e-server.mjs";

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
// Playwright empties outputDir at every run start. The HTML reporter also
// clears its own folder in onEnd before writing. Keep the report outside
// outputDir, and register JSON after HTML so that clear does not delete it.
const evidenceOutputDir = process.env.ZUDO_SG_E2E_OUTPUT_DIR ?? "test-results";
const evidenceReportDir = process.env.ZUDO_SG_E2E_REPORT_DIR ?? "playwright-report";
assertEvidenceDirsDoNotOverlap(evidenceOutputDir, evidenceReportDir);
const retainStructuredEvidence = Boolean(process.env.CI || process.env.ZUDO_SG_E2E_REPORT_DIR);
const e2eHost = resolveE2EHost();
const hostFlag = e2eHost === "localhost" ? "" : ` --host ${e2eHost}`;
const smokeServer = createStaticPreviewServer({
  entry: "root",
  projectRoot: PROJECT_ROOT,
  host: e2eHost,
  distPath: "dist",
  buildCommand: "pnpm build",
  command: `pnpm exec zfb preview${hostFlag} --port {port}`,
  urlPath: "/",
  timeout: 60_000,
});
const demoSmokeServer = createStaticPreviewServer({
  entry: "demo",
  projectRoot: PROJECT_ROOT,
  host: e2eHost,
  distPath: "apps/demo/dist",
  buildCommand: "pnpm --filter @zudo-sg/demo build",
  command: `pnpm --filter @zudo-sg/demo exec zfb preview${hostFlag} --port {port}`,
  urlPath: "/",
  timeout: 60_000,
});

export default defineConfig({
  testDir: "./e2e",
  outputDir: evidenceOutputDir,
  retries: process.env.CI ? 1 : 0,
  reporter: retainStructuredEvidence
    ? [
        ["list"],
        ["html", { outputFolder: evidenceReportDir, open: "never" }],
        ["json", { outputFile: `${evidenceReportDir}/report.json` }],
      ]
    : "list",
  use: {
    baseURL: smokeServer.origin,
    // on-first-retry records nothing when --retries=0. retain-on-failure
    // keeps the trace of the attempt that actually failed.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Note: all entries here start for every test run regardless of which
  // --project is selected (Playwright starts webServer globally, not
  // per-project) — so both dist/ and apps/demo/dist must exist before
  // running any project in this config.
  webServer: [smokeServer.webServer, demoSmokeServer.webServer],
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      // zfb-runtime 4.4.0 fragment history: A -> A#fragment -> B -> Back -> Forward.
      name: "fragment-history",
      testMatch: "fragment-history.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      // The /components catalogue gallery (#540): inline SSR thumbnails, the
      // wide band, the filter contract, and the tile-size control.
      name: "catalog-gallery",
      testMatch: "catalog-gallery.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "foreign-thumbnail-colors",
      testMatch: "foreign-thumbnail-colors.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "tokens-dashboard",
      testMatch: "tokens-dashboard.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "preview-token-panel",
      testMatch: "preview-token-panel.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "preview-fidelity",
      testMatch: "preview-fidelity.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      // #541 — the detail-page workbench (one toolbar, controlled stages).
      // Serves from the same root dist as the smoke project.
      name: "detail-workbench",
      testMatch: "detail-workbench.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      // #806 — --sg-* chrome token namespace browser acceptance (dark/light).
      name: "chrome-token-namespace",
      testMatch: "chrome-token-namespace.spec.ts",
      use: { baseURL: smokeServer.origin },
    },
    {
      name: "demo-smoke",
      // Both demo specs serve from the same built demo dist (DEMO_SMOKE_PORT):
      // the render smoke checks, the SPA-transition regression suite, and the
      // complete refresh integration contracts.
      testMatch: ["demo-smoke.spec.ts", "demo-transition.spec.ts", "demo-refresh.spec.ts"],
      use: { baseURL: demoSmokeServer.origin },
    },
  ],
});

function assertEvidenceDirsDoNotOverlap(outputDir: string, reportDir: string): void {
  const output = resolve(PROJECT_ROOT, outputDir);
  const report = resolve(PROJECT_ROOT, reportDir);
  if (output === report || isInside(output, report) || isInside(report, output)) {
    throw new Error(
      `Playwright evidence report ${reportDir} overlaps output ${outputDir}. A later run empties the output directory, and the HTML reporter clears its own folder.`,
    );
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
