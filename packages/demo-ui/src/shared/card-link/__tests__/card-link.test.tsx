import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CardLink, ViewAllLink } from "../card-link";

describe("CardLink", () => {
  it("renders an <a> wrapping its children", () => {
    render(
      <CardLink href="/products">
        <span>Card content</span>
      </CardLink>,
    );
    const el = screen.getByRole("link");
    expect(el).toHaveAttribute("href", "/products");
    expect(el).toContainElement(screen.getByText("Card content"));
  });

  it("adds target=_blank + rel=noopener noreferrer when external", () => {
    render(
      <CardLink href="https://example.com" external>
        <span>Card content</span>
      </CardLink>,
    );
    const el = screen.getByRole("link");
    expect(el).toHaveAttribute("target", "_blank");
    expect(el).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("ViewAllLink", () => {
  it("renders an <a> with a trailing arrow", () => {
    render(<ViewAllLink href="/news">View all news</ViewAllLink>);
    const el = screen.getByRole("link", { name: /View all news/ });
    expect(el).toHaveAttribute("href", "/news");
    expect(el.textContent).toContain("→");
  });
});
