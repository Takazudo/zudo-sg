import { render } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

vi.mock("@takazudo/zfb", () => ({
  Island: ({ children, ssrFallback }: { children: unknown; ssrFallback?: unknown }) =>
    ssrFallback === undefined ? children : ssrFallback,
}));

vi.mock("@takazudo/zfb-runtime", () => ({
  ClientRouter: () => null,
  TRANSITION_BEFORE_PREPARATION: "before",
  TRANSITION_AFTER_SWAP: "after",
  TRANSITION_NAVIGATION_ABORTED: "abort",
}));

vi.mock("@takazudo/zfb/content", () => ({
  getCollection: () => [],
}));

vi.mock("../../components/router/client-router-bootstrap", () => ({
  default: () => null,
}));

import DefaultLayout from "../default";

describe("DefaultLayout theme baseline", () => {
  it("emits a light SSR root and the guarded theme prepaint script in head", () => {
    const html = render(
      <DefaultLayout title="Example" description="Example description">
        <p>Page content</p>
      </DefaultLayout>,
    );

    expect(html).toContain('<html lang="en" data-theme="light"');
    expect(html).toContain("data-theme-prepaint");
    expect(html).toContain("zudo-sg-demo-theme");
    expect(html).toContain("try{");
  });
});
