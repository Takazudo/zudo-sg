import { renderIsland, disposeAll, getByRole } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { CtaButton } from "../cta-button";

afterEach(disposeAll);

describe("CtaButton", () => {
  it("renders an <a> with the given href", () => {
    const { container } = renderIsland(function Fixture() {
      return <CtaButton href="/products">Browse</CtaButton>;
    }, {});
    const el = getByRole(container, "link", { name: /Browse/ });
    expect(el).toHaveAttribute("href", "/products");
  });

  it("defaults to the primary variant with a trailing arrow", () => {
    const { container } = renderIsland(function Fixture() {
      return <CtaButton href="/products">Browse</CtaButton>;
    }, {});
    const el = getByRole(container, "link");
    expect(el.classList.contains("bg-accent")).toBe(true);
    expect(el.textContent).toContain("→");
  });

  it("applies the secondary variant classes", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CtaButton href="/company" variant="secondary">
          Company
        </CtaButton>
      );
    }, {});
    expect(getByRole(container, "link").classList.contains("text-accent")).toBe(true);
  });

  it("omits the arrow glyph when arrow=false", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CtaButton href="/products" arrow={false}>
          Browse
        </CtaButton>
      );
    }, {});
    expect(getByRole(container, "link").textContent).not.toContain("→");
  });
});
