/**
 * @vitest-environment jsdom
 *
 * Exercises the REAL markdown runtime end-to-end (unmocked): confirms that
 * the sanitized, fence-highlighted HTML `renderMarkdown()` produces is what
 * actually lands in the DOM through ProseMd's `dangerouslySetInnerHTML`
 * mount, and that raw script/event-handler markup embedded in author
 * markdown never survives into the mounted document.
 *
 * NOT this repo's default happy-dom environment: under happy-dom 16.8.1
 * DOMPurify reports `isSupported: true` but sanitizes nothing, so this suite
 * would assert against a sanitizer that never ran (see
 * `markdown-runtime.test.ts`'s header for the same reasoning).
 */
import { render, screen, waitFor } from "@testing-library/preact";
import { beforeAll, describe, expect, it } from "vitest";
import { ProseMd } from "../prose-md";
import { renderMarkdown } from "../markdown-runtime";

// First call pays the one-time wasm instantiation cost (~3MB artifact).
const WASM_WARMUP_TIMEOUT_MS = 60_000;

beforeAll(async () => {
  await renderMarkdown("warm up");
}, WASM_WARMUP_TIMEOUT_MS);

describe("ProseMd — real markdown runtime", () => {
  it(
    "mounts sanitized, fence-highlighted HTML",
    async () => {
      render(<ProseMd markdown={"## Title\n\n```ts\nconst x = 1;\n```\n"} />);

      const heading = await screen.findByRole("heading", { level: 2, name: /title/i });
      expect(heading.closest(".zc-prose-md")).toBeTruthy();
      await waitFor(() => {
        expect(document.querySelector("pre.hi-root")).toBeTruthy();
      });
    },
    WASM_WARMUP_TIMEOUT_MS,
  );

  it(
    "never mounts raw script / event-handler markup embedded in the source",
    async () => {
      const markdown =
        "Body <script>window.__zc_xss = true;</script> text.\n\n" +
        '<img src="x" onerror="window.__zc_xss = true">\n';
      render(<ProseMd markdown={markdown} />);

      await waitFor(() => {
        expect(screen.getByText(/Body/)).toBeInTheDocument();
      });
      expect(document.querySelector("script")).toBeNull();
      expect(document.querySelector("[onerror]")).toBeNull();
    },
    WASM_WARMUP_TIMEOUT_MS,
  );
});
