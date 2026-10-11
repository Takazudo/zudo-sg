import { describe, expect, it } from "vitest";
import { getByRole, getByText, queryAllByRole, renderIsland } from "../../../test-utils/zudo-react.js";
import { NewsTeaser } from "../news-teaser";
import type { NewsItem } from "../../news-list/news-list";

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "IR", title: "Earnings notice", slug: "news/ir-1" },
];

describe("NewsTeaser", () => {
  it("renders the heading, a view-all link, and the feed rows", () => {
    const app = renderIsland(NewsTeaser, { heading: "IR News", items: ITEMS, viewAllHref: "/ir/news" });

    expect(app.container.querySelector("h2")?.textContent).toBe("IR News");
    expect(getByRole(app.container, "link", { name: /View all/ }).getAttribute("href")).toBe("/ir/news");
    expect(getByText(app.container, "Earnings notice")).toBeTruthy();
  });

  it("uses a custom view-all label when provided", () => {
    const app = renderIsland(NewsTeaser, {
      heading: "News",
      items: ITEMS,
      viewAllHref: "/news",
      viewAllLabel: "See everything",
    });

    expect(getByRole(app.container, "link", { name: /See everything/ })).toBeTruthy();
  });

  it("renders no filter bar (always showFilter=false on the underlying NewsList)", () => {
    const app = renderIsland(NewsTeaser, { heading: "News", items: ITEMS, viewAllHref: "/news" });

    expect(queryAllByRole(app.container, "group", { name: "Filter by category" })).toHaveLength(0);
  });

  it("renders the intro copy when provided, and omits it when absent", () => {
    const withIntro = renderIsland(NewsTeaser, {
      heading: "News",
      items: ITEMS,
      viewAllHref: "/news",
      intro: "A roundup.",
    });
    expect(getByText(withIntro.container, "A roundup.")).toBeTruthy();
    withIntro.dispose();

    const withoutIntro = renderIsland(NewsTeaser, { heading: "News", items: ITEMS, viewAllHref: "/news" });
    expect(queryAllByRole(withoutIntro.container, "paragraph")).toHaveLength(0);
    expect(withoutIntro.container.textContent).not.toContain("A roundup.");
  });
});
