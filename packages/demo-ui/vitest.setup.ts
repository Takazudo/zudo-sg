import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { disposeAll } from "./src/test-utils/zudo-react.js";

afterEach(disposeAll);

beforeEach(() => {
  const happy = (
    globalThis as unknown as {
      happyDOM?: { settings: { navigation: { disableChildFrameNavigation: boolean } } };
    }
  ).happyDOM;
  if (happy) happy.settings.navigation.disableChildFrameNavigation = true;
});
