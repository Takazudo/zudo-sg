import { renderIsland, disposeAll, getByText, getByRole } from "../../../test-utils/zudo-react";
import { afterEach, describe, expect, it } from "vitest";
import { CardLink, ViewAllLink } from "../card-link";

afterEach(disposeAll);

describe("CardLink", () => {
  it("renders an <a> wrapping its children", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CardLink href="/products">
          <span>Card content</span>
        </CardLink>
      );
    }, {});
    const el = getByRole(container, "link");
    expect(el).toHaveAttribute("href", "/products");
    expect(el).toContainElement(getByText(container, "Card content"));
  });

  it("adds target=_blank + rel=noopener noreferrer when external", () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <CardLink href="https://example.com" external>
          <span>Card content</span>
        </CardLink>
      );
    }, {});
    const el = getByRole(container, "link");
    expect(el).toHaveAttribute("target", "_blank");
    expect(el).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("ViewAllLink", () => {
  it("renders an <a> with a trailing arrow", () => {
    const { container } = renderIsland(function Fixture() {
      return <ViewAllLink href="/news">View all news</ViewAllLink>;
    }, {});
    const el = getByRole(container, "link", { name: /View all news/ });
    expect(el).toHaveAttribute("href", "/news");
    expect(el.textContent).toContain("→");
  });
});
