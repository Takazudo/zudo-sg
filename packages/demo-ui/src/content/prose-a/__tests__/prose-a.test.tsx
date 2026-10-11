import { describe, expect, it } from "vitest";
import { getByRole } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseA } from "../prose-a";

describe("ProseA", () => {
  it("renders a link with its href and children", () => {
    const root = renderStatic(<ProseA href="/docs">Read the docs</ProseA>);
    const link = getByRole(root, "link", { name: "Read the docs" });
    expect(link.getAttribute("href")).toBe("/docs");
    expect(link.classList.contains("text-accent")).toBe(true);
  });

  it("skips prose link styling for hash-link anchors", () => {
    const root = renderStatic(
      <ProseA href="#section" class="hash-link">
        #
      </ProseA>,
    );
    const link = getByRole(root, "link", { name: "#" });
    expect(link.classList.contains("hash-link")).toBe(true);
    expect(link.classList.contains("text-accent")).toBe(false);
  });
});
