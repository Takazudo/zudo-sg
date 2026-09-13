// Shared DOM-suite setup for the package-scoped vitest run (node env, no
// setupFiles). Import it first from any `// @vitest-environment happy-dom`
// suite. Mirrors the root `vitest.setup.ts`, which also applies when the root
// config runs these suites — every step here is idempotent.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { afterEach, beforeEach } from "vitest";

afterEach(() => {
  cleanup();
});

// #357: stop Happy DOM's async child-frame navigation for real-src preview frames.
beforeEach(() => {
  const happy = (
    globalThis as unknown as {
      happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } };
    }
  ).happyDOM;
  if (happy) happy.settings.navigation.disableChildFrameNavigation = true;
});
