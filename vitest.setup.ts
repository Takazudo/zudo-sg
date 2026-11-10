// Vitest global setup.
//
// - @testing-library/jest-dom adds DOM matchers (toBeInTheDocument, toHaveAttribute…).
import "./vitest-jest-dom.ts";
import { afterEach, beforeEach } from "vitest";
import { disposeAll as disposeDemoUiIslands } from "./packages/demo-ui/src/test-utils/zudo-react.js";
import { disposeAll as disposeStyleguideIslands } from "./packages/styleguide/src/__tests__/helpers/zudo-react.js";

afterEach(() => {
  const failures: unknown[] = [];
  for (const dispose of [disposeDemoUiIslands, disposeStyleguideIslands]) {
    try {
      dispose();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "zudo-react test teardown failed");
  }
});

// #357: Happy DOM starts an async iframe navigation for real-src preview frames and dumps
// AsyncTaskManager abort traces at teardown. Disabling child-frame navigation stops the task
// from ever starting (no server runs under vitest). Mirrors css-injection.test.ts's local use.
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
  // happy-dom 21 does not load iframe documents unless page loading is on.
  // Child-frame navigation stays off so preview `src` values are not fetched.
  if (happy) {
    happy.settings.enableIframePageLoading = true;
    happy.settings.navigation.disableChildFrameNavigation = true;
  }
});
