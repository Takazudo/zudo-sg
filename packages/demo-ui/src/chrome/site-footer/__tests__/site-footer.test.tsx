import { describe, expect, it } from "vitest";
import { getByRole, getByText, queryAllByRole, renderIsland } from "../../../test-utils/zudo-react.js";
import type { NavSection } from "../../site-nav/site-nav";
import { SiteFooter } from "../site-footer";

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
    const app = renderIsland(SiteFooter, { sections: SECTIONS });

    expect(queryAllByRole(app.container, "group")).toHaveLength(2);
    expect(getByRole(app.container, "link", { name: "About" }).getAttribute("href")).toBe("/company/about");
  });

  it("links a section's column label when it has a top link", () => {
    const app = renderIsland(SiteFooter, { sections: SECTIONS });

    expect(getByRole(app.container, "link", { name: "Company" }).getAttribute("href")).toBe("/company");
  });

  it("renders a section's label as plain text when it has no top link", () => {
    const app = renderIsland(SiteFooter, { sections: SECTIONS });

    expect(queryAllByRole(app.container, "link", { name: "Products" })).toHaveLength(0);
    expect(getByText(app.container, "Products")).toBeTruthy();
  });

  it("renders the copyright line with the given brand and current year", () => {
    const app = renderIsland(SiteFooter, { sections: SECTIONS, brand: "Acme Corp." });
    const year = new Date().getFullYear();

    expect(getByText(app.container, new RegExp(`Copyright.*${year}.*Acme Corp\\.`))).toBeTruthy();
  });

  it("omits the policy-links nav when none are given", () => {
    const app = renderIsland(SiteFooter, { sections: SECTIONS });

    expect(queryAllByRole(app.container, "navigation", { name: "Policy links" })).toHaveLength(0);
  });

  it("renders policy links when given", () => {
    const app = renderIsland(SiteFooter, {
      sections: SECTIONS,
      policyLinks: [{ label: "Privacy policy", href: "/privacy" }],
    });

    expect(getByRole(app.container, "link", { name: "Privacy policy" }).getAttribute("href")).toBe("/privacy");
  });
});
