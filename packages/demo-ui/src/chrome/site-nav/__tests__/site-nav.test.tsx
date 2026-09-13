import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ThemeControl } from "../../../shared/theme-control/theme-control";
import { SiteNav, type NavSection } from "../site-nav";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [
      { label: "About", href: "/company/about", slug: "company/about", order: 1 },
      { label: "Profile", href: "/company/profile", slug: "company/profile", order: 2 },
    ],
  },
  {
    label: "No top link",
    order: 2,
    children: [{ label: "Child A", href: "/x/a", slug: "x/a", order: 1 }],
  },
];

describe("SiteNav", () => {
  it("renders one <details> per section, each with the data-nav-item hook", () => {
    render(<SiteNav sections={SECTIONS} />);
    const items = document.querySelectorAll("[data-nav-item]");
    expect(items).toHaveLength(2);
    expect(items[0]?.tagName).toBe("DETAILS");
  });

  it("renders a section's top link as the first child link ('no self-link' rule)", () => {
    render(<SiteNav sections={SECTIONS} />);
    const companyLinks = screen.getAllByRole("link", { name: /Company|About|Profile/ });
    // First rendered link inside the Company panel is the section-top link itself.
    expect(companyLinks[0]).toHaveAttribute("href", "/company");
  });

  it("does not repeat a section with no distinct top link", () => {
    render(<SiteNav sections={SECTIONS} />);
    // "No top link" has no `href`, so it must not render as a link anywhere
    // outside its own <summary> (which is not a link).
    expect(screen.queryByRole("link", { name: "No top link" })).not.toBeInTheDocument();
    expect(screen.getByText("No top link").tagName).toBe("SPAN");
  });

  it("defaults-open the current section and syncs aria-expanded on its summary", () => {
    render(<SiteNav sections={SECTIONS} currentSlug="company/profile" />);
    const companyItem = document.querySelector('[data-section="Company"]') as HTMLDetailsElement;
    expect(companyItem.open).toBe(true);
    expect(companyItem.querySelector("[data-nav-trigger]")).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves non-current sections closed", () => {
    render(<SiteNav sections={SECTIONS} currentSlug="company/profile" />);
    const otherItem = document.querySelector('[data-section="No top link"]') as HTMLDetailsElement;
    expect(otherItem.open).toBe(false);
  });

  it("mounts the mobile top-bar theme control without adding a second navigation panel", () => {
    render(<SiteNav sections={SECTIONS} mobileThemeControl={<ThemeControl />} />);
    const control = document.querySelector('[data-theme-control="mobile"] button');
    expect(control).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("group", { name: "Switch business context" })).not.toBeInTheDocument();
  });

  it("wires the toggle checkbox to the drawer via matching ids", () => {
    render(<SiteNav sections={SECTIONS} />);
    const toggle = document.querySelector("[data-nav-toggle]");
    const drawer = document.querySelector('nav[aria-label="Global navigation"]');
    expect(toggle).toHaveAttribute("aria-controls", drawer?.getAttribute("id"));
  });
});
