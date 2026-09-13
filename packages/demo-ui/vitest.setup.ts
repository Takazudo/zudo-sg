import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { afterEach, beforeEach } from "vitest";

afterEach(cleanup);

beforeEach(() => {
  const happy = (
    globalThis as unknown as {
      happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } };
    }
  ).happyDOM;
  if (happy) happy.settings.navigation.disableChildFrameNavigation = true;
});
