import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "../site-footer";
import type { NavSection } from "../../site-nav/site-nav";

const SECTIONS: NavSection[] = [
  {
    label: "Company",
    href: "/company",
    order: 1,
    children: [{ label: "About", href: "/company/about", slug: "company/about", order: 1 }],
  },
  {
    label: "Products",
    order: 2,
    children: [{ label: "Widgets", href: "/products/widgets", slug: "products/widgets", order: 1 }],
  },
];

describe("SiteFooter", () => {
  it("renders one sitemap column per section, with children as links", () => {
    render(<SiteFooter sections={SECTIONS} />);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/company/about");
  });

  it("links a section's column label when it has a top link", () => {
    render(<SiteFooter sections={SECTIONS} />);
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
  });

  it("renders a section's label as plain text when it has no top link", () => {
    render(<SiteFooter sections={SECTIONS} />);
    expect(screen.queryByRole("link", { name: "Products" })).not.toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
  });

  it("renders the copyright line with the given brand and current year", () => {
    render(<SiteFooter sections={SECTIONS} brand="Acme Corp." />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`Copyright.*${year}.*Acme Corp\\.`))).toBeInTheDocument();
  });

  it("omits the policy-links nav when none are given", () => {
    render(<SiteFooter sections={SECTIONS} />);
    expect(screen.queryByRole("navigation", { name: "Policy links" })).not.toBeInTheDocument();
  });

  it("renders policy links when given", () => {
    render(<SiteFooter sections={SECTIONS} policyLinks={[{ label: "Privacy policy", href: "/privacy" }]} />);
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  });
});
