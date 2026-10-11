import { describe, expect, it } from "vitest";
import { getByRole, getByText, queryAllByRole, renderIsland } from "../../../test-utils/zudo-react.js";
import { NewsList, type NewsItem } from "../news-list";

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "Sustainability", title: "First item", slug: "news/first" },
  { date: "2026-05-08", category: "Products", title: "Second item (external)", slug: "news/second", href: "https://example.com/x" },
];

describe("NewsList", () => {
  it("renders a row per item with a formatted date and category badge", () => {
    const app = renderIsland(NewsList, { items: ITEMS });

    expect(getByText(app.container, "First item")).toBeTruthy();
    expect(getByText(app.container, "2026.06.19")).toBeTruthy();
    expect(getByText(app.container, "Sustainability")).toBeTruthy();
  });

  it("links to /<slug> when href is absent, and to href when present", () => {
    const app = renderIsland(NewsList, { items: ITEMS });

    expect(getByRole(app.container, "link", { name: /First item/ }).getAttribute("href")).toBe("/news/first");
    expect(getByRole(app.container, "link", { name: /Second item/ }).getAttribute("href")).toBe("https://example.com/x");
  });

  it("shows an empty-state message when there are no items", () => {
    const app = renderIsland(NewsList, { items: [] });

    expect(getByText(app.container, "There are no news items yet.")).toBeTruthy();
  });

  it("renders the heading only when provided", () => {
    const withHeading = renderIsland(NewsList, { items: ITEMS, heading: "News" });
    expect(withHeading.container.querySelector("h2")?.textContent).toBe("News");
    withHeading.dispose();

    const withoutHeading = renderIsland(NewsList, { items: ITEMS });
    expect(withoutHeading.container.querySelector("h2")).toBeNull();
  });

  it("shows the filter bar only when showFilter is set and there is more than one category", () => {
    const multiple = renderIsland(NewsList, { items: ITEMS, showFilter: true });
    expect(queryAllByRole(multiple.container, "group", { name: "Filter by category" })).toHaveLength(1);
    multiple.dispose();

    const single = renderIsland(NewsList, { items: [ITEMS[0]!], showFilter: true });
    expect(queryAllByRole(single.container, "group", { name: "Filter by category" })).toHaveLength(0);
  });
});
