import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ThemeControl } from "../../../shared/theme-control/theme-control";
import type { NavSection } from "../../site-nav/site-nav";
import { SiteHeader } from "../site-header";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Leadership", href: "/company/leadership", slug: "company/leadership", order: 2 },
    ],
  },
  {
    label: "News",
    order: 2,
    children: [{ label: "Latest news", href: "/news", slug: "news", order: 1 }],
  },
];

describe("SiteHeader", () => {
  it("renders the brand lockup linking to brandHref", () => {
    render(<SiteHeader sections={SECTIONS} brand="Acme" brandHref="/home" />);
    const link = screen.getByRole("link", { name: /Acme/ });
    expect(link).toHaveAttribute("href", "/home");
  });

  it("renders a Browse trigger with an accessible name and matching panel hook", () => {
    render(<SiteHeader sections={SECTIONS} />);
    const trigger = screen.getByRole("button", { name: "Browse site sections" });
    const panel = document.querySelector("[data-ctx-panel]");
    expect(trigger).toHaveTextContent("Browse");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", panel?.getAttribute("id"));
    expect(trigger).toHaveClass("min-h-[44px]", "min-w-[44px]");
  });

  it("walks the supplied section tree in source order with real route targets", () => {
    render(<SiteHeader sections={SECTIONS} />);
    const panel = document.querySelector("[data-ctx-panel]") as HTMLElement;
    const headings = Array.from(panel.querySelectorAll("h2")).map((heading) => heading.textContent);
    expect(headings).toEqual(["Company", "News"]);
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("link", { name: "News" })).toHaveAttribute("href", "/news");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/company/about");
    expect(screen.getByRole("link", { name: "Latest news" })).toHaveAttribute("href", "/news");
  });

  it("does not render a Browse trigger or panel for an empty tree", () => {
    render(<SiteHeader sections={[]} />);
    expect(screen.queryByRole("button", { name: "Browse site sections" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-ctx-panel]")).not.toBeInTheDocument();
  });

  it("mounts the desktop theme control in the header utility group", () => {
    render(<SiteHeader sections={SECTIONS} desktopThemeControl={<ThemeControl />} />);
    const control = document.querySelector('[data-theme-control="desktop"] button');
    expect(control).toHaveAttribute("aria-pressed", "false");
  });

  it("exposes the search toggle a11y hooks with matching ids", () => {
    render(<SiteHeader sections={SECTIONS} />);
    const form = document.querySelector("[data-search-form]");
    const trigger = form?.querySelector("[data-search-trigger]");
    const input = form?.querySelector("[data-search-input]");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", input?.getAttribute("id"));
  });

  it("submits search as a plain GET form (works with no JS)", () => {
    render(<SiteHeader sections={SECTIONS} />);
    const form = document.querySelector("[data-search-form]");
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
    expect(form?.querySelector('input[name="q"]')).toBeInTheDocument();
  });

  it("merges an extra class onto the header", () => {
    render(<SiteHeader sections={SECTIONS} class="extra-class" />);
    expect(document.querySelector("header")).toHaveClass("extra-class");
  });
});
