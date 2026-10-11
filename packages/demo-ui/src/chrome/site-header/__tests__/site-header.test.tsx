import { describe, expect, it } from "vitest";
import { getByRole, queryAllByRole, renderIsland } from "../../../test-utils/zudo-react.js";
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

function ThemeControlFixture() {
  return <button type="button" aria-pressed="false">Theme control</button>;
}

describe("SiteHeader", () => {
  it("renders the brand lockup linking to brandHref", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS, brand: "Acme", brandHref: "/home" });
    const link = getByRole(app.container, "link", { name: /Acme/ });

    expect(link.getAttribute("href")).toBe("/home");
  });

  it("renders a Browse trigger with an accessible name and matching panel hook", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS });
    const trigger = getByRole(app.container, "button", { name: "Browse site sections" });
    const panel = app.container.querySelector("[data-ctx-panel]");

    expect(trigger.textContent).toContain("Browse");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(panel?.getAttribute("id"));
    expect(trigger.classList.contains("min-h-[44px]")).toBe(true);
    expect(app.container.querySelector(".zc-context-switcher")).not.toBeNull();
    expect(app.container.querySelector(".zc-context-switcher-arrow")).not.toBeNull();
    expect(panel?.id).toBe("zui-ctx-panel");
  });

  it("walks the supplied section tree in source order with real route targets", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS });
    const panel = app.container.querySelector("[data-ctx-panel]") as HTMLElement;
    const headings = Array.from(panel.querySelectorAll("h2")).map((heading) => heading.textContent);

    expect(headings).toEqual(["Company", "News"]);
    expect(getByRole(app.container, "link", { name: "Company" }).getAttribute("href")).toBe("/company");
    expect(getByRole(app.container, "link", { name: "News" }).getAttribute("href")).toBe("/news");
    expect(getByRole(app.container, "link", { name: "About" }).getAttribute("href")).toBe("/company/about");
    expect(getByRole(app.container, "link", { name: "Latest news" }).getAttribute("href")).toBe("/news");
  });

  it("does not render a Browse trigger or panel for an empty tree", () => {
    const app = renderIsland(SiteHeader, { sections: [] });

    expect(queryAllByRole(app.container, "button", { name: "Browse site sections" })).toHaveLength(0);
    expect(app.container.querySelector("[data-ctx-panel]")).toBeNull();
  });

  it("mounts the desktop theme control in the header utility group", () => {
    function HeaderWithTheme() {
      return <SiteHeader sections={SECTIONS} desktopThemeControl={<ThemeControlFixture />} />;
    }
    const app = renderIsland(HeaderWithTheme, {});

    expect(app.container.querySelector('[data-theme-control="desktop"] button')?.getAttribute("aria-pressed")).toBe("false");
  });

  it("exposes the search toggle a11y hooks with matching ids", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS });
    const form = app.container.querySelector("[data-search-form]");
    const trigger = form?.querySelector("[data-search-trigger]");
    const input = form?.querySelector("[data-search-input]");

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.getAttribute("aria-controls")).toBe(input?.getAttribute("id"));
    expect(app.container.querySelector(".zc-header-search")).not.toBeNull();
  });

  it("submits search as a plain GET form (works with no JS)", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS });
    const form = app.container.querySelector("[data-search-form]");

    expect(form?.getAttribute("action")).toBe("/search");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.querySelector('input[name="q"]')).not.toBeNull();
  });

  it("merges an extra class onto the header", () => {
    const app = renderIsland(SiteHeader, { sections: SECTIONS, class: "extra-class" });

    expect(app.container.querySelector("header")?.classList.contains("extra-class")).toBe(true);
  });
});
