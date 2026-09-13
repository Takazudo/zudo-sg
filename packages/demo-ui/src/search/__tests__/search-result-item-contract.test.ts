/**
 * SSR/CSR markup contract test for search result rows.
 *
 * `search-results/search-results.tsx` (SSR JSX) and
 * `search-result-item-renderer.ts` (CSR `innerHTML` string-builder, used by
 * the enhancer island) must both build their markup from the SAME class
 * constants in `../search-result-item-classes.ts`. This test drives the CSR
 * renderer and asserts its output uses every one of those shared constants
 * (and only omits the ones that are conditionally absent), so a future edit
 * to one side without the other is caught here rather than by visual drift.
 */
import { describe, expect, it } from "vitest";
import { renderItem } from "../search-result-item-renderer";
import {
  ROW_LINK_CLASS,
  ROW_HEADER_CLASS,
  ROW_TITLE_CLASS,
  ROW_BADGE_CLASS,
  ROW_LEAD_CLASS,
  ROW_HREF_CLASS,
} from "../search-result-item-classes";
import type { SearchDoc } from "../search-doc";

const baseDoc: SearchDoc = {
  title: "Test page",
  href: "/test/page",
  section: "Company",
  description: "A test description",
  excerpt: "",
};

describe("renderItem", () => {
  it("includes ROW_LINK_CLASS on the <a>", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_LINK_CLASS);
  });

  it("includes ROW_HEADER_CLASS on the header span", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_HEADER_CLASS);
  });

  it("includes ROW_TITLE_CLASS on the title <b>", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_TITLE_CLASS);
  });

  it("renders a badge with ROW_BADGE_CLASS when section is present", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_BADGE_CLASS);
    expect(html).toContain(">Company<");
  });

  it("omits the badge element when section is empty", () => {
    const html = renderItem({ ...baseDoc, section: "" });
    expect(html).not.toContain(ROW_BADGE_CLASS);
  });

  it("renders the lead with ROW_LEAD_CLASS when description is present", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_LEAD_CLASS);
    expect(html).toContain(">A test description<");
  });

  it("falls back to excerpt as the lead when description is empty", () => {
    const doc: SearchDoc = { ...baseDoc, description: "", excerpt: "Body excerpt text" };
    const html = renderItem(doc);
    expect(html).toContain(ROW_LEAD_CLASS);
    expect(html).toContain(">Body excerpt text<");
  });

  it("omits the lead element when both description and excerpt are empty", () => {
    const doc: SearchDoc = { ...baseDoc, description: "", excerpt: "" };
    const html = renderItem(doc);
    expect(html).not.toContain(ROW_LEAD_CLASS);
  });

  it("includes ROW_HREF_CLASS on the href caption", () => {
    const html = renderItem(baseDoc);
    expect(html).toContain(ROW_HREF_CLASS);
    expect(html).toContain(">/test/page<");
  });

  it("escapes XSS-bearing titles", () => {
    const doc: SearchDoc = { ...baseDoc, title: "<script>alert('xss')</script>" };
    const html = renderItem(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes every shared class constant when all fields are present", () => {
    const html = renderItem(baseDoc);
    for (const cls of [
      ROW_LINK_CLASS,
      ROW_HEADER_CLASS,
      ROW_TITLE_CLASS,
      ROW_BADGE_CLASS,
      ROW_LEAD_CLASS,
      ROW_HREF_CLASS,
    ]) {
      expect(html).toContain(cls);
    }
  });
});
