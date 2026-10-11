import { describe, expect, it } from "vitest";
import { fire, flushAll, getByRole, getByText, renderIsland } from "../../../test-utils/zudo-react.js";
import { NewsFilter } from "../news-filter";
import NewsFilterEnhancer from "../news-filter-enhancer";
import { NewsList, type NewsItem } from "../../news-list/news-list";

describe("NewsFilter", () => {
  it("renders an 'All' button (pressed) plus one per category", () => {
    const app = renderIsland(NewsFilter, { categories: ["Corporate", "IR"] });

    expect(getByRole(app.container, "button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole(app.container, "button", { name: "Corporate" }).getAttribute("aria-pressed")).toBe("false");
    expect(getByRole(app.container, "button", { name: "IR" }).getAttribute("aria-pressed")).toBe("false");
  });
});

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "Corporate", title: "Corporate item", slug: "news/a" },
  { date: "2026-06-18", category: "IR", title: "IR item", slug: "news/b" },
];

function NewsFilterFixture() {
  return (
    <>
      <NewsList items={ITEMS} showFilter />
      <NewsFilterEnhancer />
    </>
  );
}

describe("NewsFilter + NewsFilterEnhancer + NewsList (SSR and enhancer mounted together)", () => {
  it("hides non-matching rows on click and restores them via 'All'", async () => {
    const app = renderIsland(NewsFilterFixture, {});
    const corporate = getByText(app.container, "Corporate item").closest("li") as HTMLLIElement;
    const ir = getByText(app.container, "IR item").closest("li") as HTMLLIElement;
    const irButton = getByRole(app.container, "button", { name: "IR" });
    const allButton = getByRole(app.container, "button", { name: "All" });

    expect(corporate.hidden).toBe(false);
    expect(ir.hidden).toBe(false);

    fire(irButton, "click");
    await flushAll();

    expect(corporate.hidden).toBe(true);
    expect(ir.hidden).toBe(false);
    expect(irButton.getAttribute("aria-pressed")).toBe("true");
    expect(allButton.getAttribute("aria-pressed")).toBe("false");

    fire(allButton, "click");
    await flushAll();

    expect(corporate.hidden).toBe(false);
    expect(ir.hidden).toBe(false);
    expect(app.container.isConnected).toBe(true);
    app.dispose();
    expect(app.container.isConnected).toBe(false);
  });

  it("removes the click handler when disposed", async () => {
    const app = renderIsland(NewsFilterFixture, {});
    const corporate = getByText(app.container, "Corporate item").closest("li") as HTMLLIElement;
    const irButton = getByRole(app.container, "button", { name: "IR" });

    app.dispose();
    fire(irButton, "click");
    await flushAll();

    expect(corporate.hidden).toBe(false);
    expect(irButton.getAttribute("aria-pressed")).toBe("false");
  });
});
