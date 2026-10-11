import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disposeAll, flushAll, getByText, renderIsland } from "../../../test-utils/zudo-react";
import { ProseMd } from "../prose-md";
import { renderMarkdown } from "../markdown-runtime";
import type { MarkdownRenderResult } from "../markdown-runtime";

vi.mock("../markdown-runtime", () => ({
  renderMarkdown: vi.fn(),
}));

const mockedRenderMarkdown = vi.mocked(renderMarkdown);

/** A promise plus its resolver, so a test can control exactly when it settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockedRenderMarkdown.mockReset();
});

afterEach(() => {
  disposeAll();
});

describe("ProseMd", () => {
  it("shows the raw markdown as a quiet placeholder before the runtime resolves", () => {
    mockedRenderMarkdown.mockReturnValue(new Promise<MarkdownRenderResult>(() => {}));
    const island = renderIsland(ProseMd, { markdown: "## Hi" }, { mode: "mount" });

    const raw = getByText(island.container, "## Hi");
    expect(raw.tagName).toBe("PRE");
    expect(raw.closest(".zc-prose-md--pending")).toBeTruthy();
    island.dispose();
  });

  it("mounts the runtime HTML once it resolves", async () => {
    mockedRenderMarkdown.mockResolvedValue({ html: "<h2>Hi</h2>", diagnostics: [] });
    const island = renderIsland(ProseMd, { markdown: "## Hi" }, { mode: "mount" });

    await vi.waitFor(() => {
      expect(island.container.querySelector("h2")?.textContent).toBe("Hi");
    }, { timeout: 1000 });
    await flushAll();
    island.dispose();
  });

  it("shows a compact diagnostics message when the runtime returns html: null", async () => {
    mockedRenderMarkdown.mockResolvedValue({
      html: null,
      diagnostics: [
        { severity: "error", source: "internal", message: "boom", line: null, column: null },
      ],
    });
    const island = renderIsland(ProseMd, { markdown: "bad" }, { mode: "mount" });

    await vi.waitFor(() => {
      expect(island.container.querySelector('[role="alert"]')?.textContent).toContain("boom");
    }, { timeout: 1000 });
    await flushAll();
    island.dispose();
  });

  it("drops a result from a disposed instance when new props are mounted", async () => {
    const first = deferred<MarkdownRenderResult>();
    const second = deferred<MarkdownRenderResult>();
    mockedRenderMarkdown.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const oldIsland = renderIsland(ProseMd, { markdown: "first" }, { mode: "mount" });
    oldIsland.dispose();
    const currentIsland = renderIsland(ProseMd, { markdown: "second" }, { mode: "mount" });

    second.resolve({ html: "<p>second</p>", diagnostics: [] });
    await vi.waitFor(() => {
      expect(currentIsland.container.querySelector("p")?.textContent).toBe("second");
    }, { timeout: 1000 });

    first.resolve({ html: "<p>first</p>", diagnostics: [] });
    await first.promise;
    await flushAll();
    expect(currentIsland.container.querySelector("p")?.textContent).toBe("second");
    expect(currentIsland.container.querySelector("p")?.textContent).not.toBe("first");
    currentIsland.dispose();
  });

  it("does not throw when rendering finishes after disposal", async () => {
    const pending = deferred<MarkdownRenderResult>();
    mockedRenderMarkdown.mockReturnValue(pending.promise);
    const island = renderIsland(ProseMd, { markdown: "x" }, { mode: "mount" });

    island.dispose();
    pending.resolve({ html: "<p>late</p>", diagnostics: [] });
    await expect(pending.promise).resolves.toEqual({ html: "<p>late</p>", diagnostics: [] });
    await expect(flushAll()).resolves.toBeUndefined();
  });
});
