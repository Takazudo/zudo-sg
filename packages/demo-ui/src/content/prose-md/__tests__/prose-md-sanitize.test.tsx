/**
 * @vitest-environment jsdom
 *
 * Exercises the real markdown runtime and DOMPurify, then checks the rendered
 * island DOM so the sanitizer is tested at the rawHtml boundary.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { disposeAll, flushAll, renderIsland } from "../../../test-utils/zudo-react";
import { ProseMd } from "../prose-md";
import { renderMarkdown } from "../markdown-runtime";

const WASM_WARMUP_TIMEOUT_MS = 60_000;

beforeAll(async () => {
  await renderMarkdown("warm up");
}, WASM_WARMUP_TIMEOUT_MS);

afterEach(() => {
  disposeAll();
});

describe("ProseMd — real markdown runtime", () => {
  it(
    "mounts sanitized, fence-highlighted HTML",
    async () => {
      const island = renderIsland(
        ProseMd,
        { markdown: "## Title\n\n```ts\nconst x = 1;\n```\n" },
        { mode: "mount" },
      );

      await vi.waitFor(() => {
        expect(island.container.querySelector("h2")?.textContent).toBe("Title");
        // A token span proves both that syntax highlighting ran and that its
        // class-bearing markup survived DOMPurify and the rawHtml mount.
        expect(island.container.querySelector("pre.hi-root .hi-kw")).toBeTruthy();
      }, { timeout: WASM_WARMUP_TIMEOUT_MS });
      await flushAll();
      expect(island.container.querySelector(".zc-prose-md")).toBeTruthy();
    },
    WASM_WARMUP_TIMEOUT_MS,
  );

  it(
    "never mounts raw script or event-handler markup embedded in the source",
    async () => {
      const markdown =
        "Body <script>window.__zc_xss = true;</script> text.\n\n" +
        '<img src="x" onerror="window.__zc_xss = true" />\n';
      const island = renderIsland(ProseMd, { markdown }, { mode: "mount" });

      await vi.waitFor(() => {
        // A real image only appears after sanitized markdown replaces the
        // escaped pending placeholder.
        expect(island.container.querySelector("img")).toBeTruthy();
      }, { timeout: WASM_WARMUP_TIMEOUT_MS });
      await flushAll();
      expect(island.container.textContent).toContain("Body");
      expect(island.container.querySelector("script")).toBeNull();
      expect(island.container.querySelector("[onerror]")).toBeNull();
    },
    WASM_WARMUP_TIMEOUT_MS,
  );
});
