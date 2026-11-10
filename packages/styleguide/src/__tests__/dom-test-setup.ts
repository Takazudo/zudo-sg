// Shared DOM-suite setup for the package-scoped vitest run (node env, no
// setupFiles). Import it first from any `// @vitest-environment happy-dom`
// suite. Mirrors the root `vitest.setup.ts`, which also applies when the root
// config runs these suites — every step here is idempotent.
import "../../../../vitest-jest-dom.ts";
import { afterEach, beforeEach } from "vitest";
import { disposeAll } from "./helpers/zudo-react.js";

afterEach(disposeAll);

// #357: stop Happy DOM's async child-frame navigation for real-src preview frames.
beforeEach(() => {
  const happy = (
    globalThis as unknown as {
      happyDOM?: {
        settings: {
          enableIframePageLoading?: boolean;
          navigation: { disableChildFrameNavigation: boolean };
        };
      };
    }
  ).happyDOM;
  // happy-dom 21 leaves iframe.contentDocument null until page loading is enabled.
  if (happy) {
    happy.settings.enableIframePageLoading = true;
    happy.settings.navigation.disableChildFrameNavigation = true;
  }
});
