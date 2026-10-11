// Vitest global setup.
//
// - @testing-library/jest-dom adds DOM matchers (toBeInTheDocument, toHaveAttribute…).
import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// #357: Happy DOM starts an async iframe navigation for real-src preview frames and dumps
// AsyncTaskManager abort traces at teardown. Disabling child-frame navigation stops the task
// from ever starting (no server runs under vitest). Mirrors css-injection.test.ts's local use.
beforeEach(() => {
  const happy = (
    globalThis as unknown as {
      happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } };
    }
  ).happyDOM;
  if (happy) happy.settings.navigation.disableChildFrameNavigation = true;
});
