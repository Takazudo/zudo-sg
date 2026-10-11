import { describe, expect, it } from "vitest";
import { getByText, queryAllByRole, renderIsland } from "../../../test-utils/zudo-react.js";
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

function ThemeControlFixture() {
  return <button type="button" aria-pressed="false">Theme control</button>;
}

describe("SiteNav", () => {
  it("renders one <details> per section, each with the data-nav-item hook", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS });
    const items = app.container.querySelectorAll("[data-nav-item]");

    expect(items).toHaveLength(2);
    expect(items[0]?.tagName).toBe("DETAILS");
    expect(items[0]?.querySelector("[data-nav-trigger]")?.classList.contains("zc-nav-summary")).toBe(true);
    expect(items[0]?.querySelector(".zc-nav-chevron")).not.toBeNull();
    expect(app.container.querySelector(".zc-nav-toggle-icon")).not.toBeNull();
  });

  it("renders a section's top link as the first child link ('no self-link' rule)", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS });
    const companyLinks = queryAllByRole(app.container, "link", { name: /Company|About|Profile/ });

    expect(companyLinks[0]?.getAttribute("href")).toBe("/company");
  });

  it("does not repeat a section with no distinct top link", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS });

    expect(queryAllByRole(app.container, "link", { name: "No top link" })).toHaveLength(0);
    expect(getByText(app.container, "No top link").tagName).toBe("SPAN");
  });

  it("defaults-open the current section and syncs aria-expanded on its summary", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS, currentSlug: "company/profile" });
    const companyItem = app.container.querySelector('[data-section="Company"]') as HTMLDetailsElement;

    expect(companyItem.open).toBe(true);
    expect(companyItem.querySelector("[data-nav-trigger]")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("leaves non-current sections closed", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS, currentSlug: "company/profile" });
    const otherItem = app.container.querySelector('[data-section="No top link"]') as HTMLDetailsElement;

    expect(otherItem.open).toBe(false);
  });

  it("mounts the mobile top-bar theme control without adding a second navigation panel", () => {
    function NavWithTheme() {
      return <SiteNav sections={SECTIONS} mobileThemeControl={<ThemeControlFixture />} />;
    }
    const app = renderIsland(NavWithTheme, {});

    expect(app.container.querySelector('[data-theme-control="mobile"] button')?.getAttribute("aria-pressed")).toBe("false");
    expect(queryAllByRole(app.container, "group", { name: "Switch business context" })).toHaveLength(0);
  });

  it("wires the toggle checkbox to the drawer via matching ids", () => {
    const app = renderIsland(SiteNav, { sections: SECTIONS });
    const toggle = app.container.querySelector("[data-nav-toggle]");
    const drawer = app.container.querySelector('nav[aria-label="Global navigation"]');

    expect(toggle?.getAttribute("aria-controls")).toBe(drawer?.getAttribute("id"));
  });
});
