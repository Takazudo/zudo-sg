// @vitest-environment happy-dom
//
// Regression guard for #815(a): `/components/preview` is a chrome-free
// iframe document (no header, no client router — see components-preview.tsx),
// so it cannot go through `chromeProps()` like the other three engine
// routes. The marker still has to land on its built HTML per the issue's
// acceptance criteria, so this pins it directly on the document's `<html>`
// element alongside the existing `data-sg-preview-doc` marker.
import { describe, expect, it, vi } from "vitest";
import { render } from "preact-render-to-string";

vi.mock("@takazudo/zfb", () => ({
  Island: () => null,
}));

vi.mock("../_preview-app.js", () => ({
  default: () => null,
}));

vi.mock("../_context.js", () => ({
  ctx: { base: "", previewCssUrl: "/preview.css" },
  withBase: (path: string) => path,
}));

describe("components-preview engine-route marker (#815)", () => {
  it("carries data-sg-engine-route alongside data-sg-preview-doc on <html>", async () => {
    const { default: ComponentsPreviewRoute } = await import("../components-preview.js");
    const html = render(ComponentsPreviewRoute());

    expect(html).toMatch(/^<html lang="en" data-sg-preview-doc="true" data-sg-engine-route="true">/);
  });
});
