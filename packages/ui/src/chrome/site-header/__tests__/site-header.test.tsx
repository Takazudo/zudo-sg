import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteHeader, type BrandSwitcherItem } from "../site-header";

const ITEMS: BrandSwitcherItem[] = [
  { key: "corporate", label: "Corporate", href: "/", mark: "○", description: "Corporate tagline.", domain: "acme.example", current: true },
  { key: "vacuum", label: "Line A", href: "/lines/vacuum", mark: "A", description: "Line A tagline.", domain: "line-a.example", current: false },
];

describe("SiteHeader", () => {
  it("renders the brand lockup linking to brandHref", () => {
    render(<SiteHeader switcherItems={ITEMS} brand="Acme" brandHref="/home" />);
    const link = screen.getByRole("link", { name: /Acme/ });
    expect(link).toHaveAttribute("href", "/home");
  });

  it("labels the context-switcher trigger with the current item", () => {
    render(<SiteHeader switcherItems={ITEMS} />);
    const trigger = document.querySelector("[data-ctx-trigger]");
    expect(trigger).toHaveTextContent("Corporate");
  });

  it("falls back to the first item when none is marked current", () => {
    const noCurrent = ITEMS.map((item) => ({ ...item, current: false }));
    render(<SiteHeader switcherItems={noCurrent} />);
    const trigger = document.querySelector("[data-ctx-trigger]");
    expect(trigger).toHaveTextContent("Corporate");
  });

  it("renders a switcher card per item, marking the current one", () => {
    render(<SiteHeader switcherItems={ITEMS} />);
    const currentCard = screen.getByRole("link", { name: /Corporate/, current: "location" });
    expect(currentCard).toHaveAttribute("data-ctx-card-key", "corporate");
    const otherCard = screen.getByRole("link", { name: /Line A/ });
    expect(otherCard).not.toHaveAttribute("aria-current");
  });

  it("exposes the context-switcher a11y hooks with matching ids", () => {
    render(<SiteHeader switcherItems={ITEMS} />);
    const trigger = document.querySelector("[data-ctx-trigger]");
    const panel = document.querySelector("[data-ctx-panel]");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", panel?.getAttribute("id"));
  });

  it("exposes the search toggle a11y hooks with matching ids", () => {
    render(<SiteHeader switcherItems={ITEMS} />);
    const form = document.querySelector("[data-search-form]");
    const trigger = form?.querySelector("[data-search-trigger]");
    const input = form?.querySelector("[data-search-input]");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", input?.getAttribute("id"));
  });

  it("submits search as a plain GET form (works with no JS)", () => {
    render(<SiteHeader switcherItems={ITEMS} />);
    const form = document.querySelector("[data-search-form]");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(form?.querySelector('input[name="q"]')).toBeInTheDocument();
  });

  it("merges an extra class onto the header", () => {
    render(<SiteHeader switcherItems={ITEMS} class="extra-class" />);
    expect(document.querySelector("header")).toHaveClass("extra-class");
  });
});
