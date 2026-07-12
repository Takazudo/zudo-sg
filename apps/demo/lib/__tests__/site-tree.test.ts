import { describe, expect, it } from "vitest";
import { buildTreeFromEntries, getBreadcrumbs, normalizeSlug, slugToHref } from "../site-tree-core";

describe("normalizeSlug", () => {
  it("strips a trailing index segment", () => {
    expect(normalizeSlug("company/index")).toBe("company");
    expect(normalizeSlug("index")).toBe("");
  });

  it("strips leading/trailing slashes", () => {
    expect(normalizeSlug("/company/about/")).toBe("company/about");
  });

  it("leaves a non-index slug unchanged", () => {
    expect(normalizeSlug("company/profile")).toBe("company/profile");
  });
});

describe("slugToHref", () => {
  it("maps the empty/home slug to /", () => {
    expect(slugToHref("")).toBe("/");
    expect(slugToHref("index")).toBe("/");
  });

  it("prefixes a non-empty slug with /", () => {
    expect(slugToHref("company/about")).toBe("/company/about");
  });
});

describe("buildTreeFromEntries", () => {
  it("groups entries by frontmatter.section, falling back to the slug's first segment", () => {
    const sections = buildTreeFromEntries([
      { slug: "company/about", data: { section: "Company", title: "About" } },
      { slug: "company/team", data: { section: "Company", title: "Team" } },
      { slug: "news/2024-01", data: { title: "January update" } },
    ]);

    const labels = sections.map((s) => s.label).sort();
    expect(labels).toEqual(["Company", "news"]);

    const company = sections.find((s) => s.label === "Company");
    expect(company?.children.map((c) => c.label)).toEqual(["About", "Team"]);
  });

  it("excludes navHidden entries but still resolves them as a section-top href", () => {
    const sections = buildTreeFromEntries([
      { slug: "company/index", data: { section: "Company", navHidden: true } },
      { slug: "company/about", data: { section: "Company", title: "About" } },
    ]);

    const company = sections.find((s) => s.label === "Company");
    expect(company?.href).toBe("/company");
    expect(company?.children.map((c) => c.slug)).toEqual(["company/about"]);
  });

  it("sorts sections and children by order, then label", () => {
    const sections = buildTreeFromEntries([
      { slug: "b/page", data: { section: "B", sectionOrder: 2, navOrder: 1, title: "Page" } },
      { slug: "a/page", data: { section: "A", sectionOrder: 1, navOrder: 1, title: "Page" } },
    ]);
    expect(sections.map((s) => s.label)).toEqual(["A", "B"]);
  });
});

describe("getBreadcrumbs", () => {
  const tree = {
    sections: buildTreeFromEntries([
      { slug: "company/about", data: { section: "Company", title: "About" } },
    ]),
  };

  it("returns just Home for the root slug", () => {
    expect(getBreadcrumbs(undefined, tree)).toEqual([{ label: "Home", href: "/" }]);
  });

  it("resolves a known page to [Home, Section, Page]", () => {
    expect(getBreadcrumbs("company/about", tree)).toEqual([
      { label: "Home", href: "/" },
      { label: "Company", href: undefined },
      { label: "About" },
    ]);
  });

  it("falls back to a naive segment split for a slug not in the tree", () => {
    expect(getBreadcrumbs("unlisted/page", tree)).toEqual([
      { label: "Home", href: "/" },
      { label: "unlisted", href: "/unlisted/page".replace("/page", "") },
      { label: "page" },
    ]);
  });

  it("prepends a line-home crumb when lineKey is set", () => {
    const lineTree = { sections: [] as ReturnType<typeof buildTreeFromEntries> };
    expect(getBreadcrumbs("lines/vacuum", lineTree, "vacuum")).toEqual([
      { label: "Home", href: "/" },
      { label: "vacuum" },
    ]);
  });
});
