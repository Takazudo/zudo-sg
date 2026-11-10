import "../../vitest-jest-dom.ts";
import { afterEach, beforeEach } from "vitest";
import { disposeAll } from "./src/test-utils/zudo-react.js";

afterEach(disposeAll);

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
  if (happy) {
    happy.settings.enableIframePageLoading = true;
    happy.settings.navigation.disableChildFrameNavigation = true;
  }
});
