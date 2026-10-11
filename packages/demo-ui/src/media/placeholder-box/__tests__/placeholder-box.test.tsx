import { describe, expect, it } from "vitest";
import { getByRole } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../../content/__tests__/render-static";
import { PlaceholderBox } from "../placeholder-box";

describe("PlaceholderBox", () => {
  it("renders the label as its accessible name", () => {
    const root = renderStatic(<PlaceholderBox label="hero-image.png" />);
    expect(getByRole(root, "img", { name: "hero-image.png" })).toBeTruthy();
  });

  it("falls back to alt, then src, then 'image'", () => {
    const altRoot = renderStatic(<PlaceholderBox alt="Product photo" src="/img/product.png" />);
    expect(getByRole(altRoot, "img", { name: "Product photo" })).toBeTruthy();

    const srcRoot = renderStatic(<PlaceholderBox src="/img/diagram.svg" />);
    expect(getByRole(srcRoot, "img", { name: "/img/diagram.svg" })).toBeTruthy();

    const fallbackRoot = renderStatic(<PlaceholderBox />);
    expect(getByRole(fallbackRoot, "img", { name: "image" })).toBeTruthy();
  });

  it("sets aspect-ratio style when aspect is provided", () => {
    const root = renderStatic(<PlaceholderBox label="16:9" aspect="16/9" />);
    const el = getByRole(root, "img", { name: "16:9" });
    // happy-dom normalizes the value to "16 / 9" (spaces around the slash).
    expect(el.style.aspectRatio.replace(/\s+/g, "")).toBe("16/9");
  });

  it("renders as a <span> (phrasing content, safe inside <p>)", () => {
    const root = renderStatic(<PlaceholderBox label="hero-image.png" />);
    expect(getByRole(root, "img", { name: "hero-image.png" }).tagName).toBe("SPAN");
  });
});
