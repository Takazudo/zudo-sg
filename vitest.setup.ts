// Vitest global setup.
//
// - @testing-library/jest-dom adds DOM matchers (toBeInTheDocument, toHaveAttribute…).
// - @testing-library/preact's cleanup runs after each test to unmount renders.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/preact";

afterEach(() => {
  cleanup();
});

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
