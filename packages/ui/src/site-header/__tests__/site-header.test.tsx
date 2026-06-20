import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "../site-header";

const nav = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
];

describe("SiteHeader", () => {
  it("renders the brand linked to brandHref", () => {
    render(<SiteHeader brand="zudo-sg" brandHref="/home" />);
    const brand = screen.getByRole("link", { name: "zudo-sg" });
    expect(brand).toHaveAttribute("href", "/home");
  });

  it("renders nav items", () => {
    render(<SiteHeader brand="x" nav={nav} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
  });

  it("marks the active nav item with aria-current=page", () => {
    render(<SiteHeader brand="x" nav={nav} activePath="/docs" />);
    const docs = screen.getByRole("link", { name: "Docs" });
    expect(docs).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("applies sticky positioning by default and drops it when sticky=false", () => {
    const { container, rerender } = render(<SiteHeader brand="x" nav={nav} />);
    expect(container.querySelector("header")?.className).toContain("sticky");
    rerender(<SiteHeader brand="x" nav={nav} sticky={false} />);
    expect(container.querySelector("header")?.className).not.toContain("sticky");
  });
});
