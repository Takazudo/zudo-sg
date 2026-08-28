import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { NewsFilter } from "../news-filter";
import NewsFilterEnhancer from "../news-filter-enhancer";
import { NewsList, type NewsItem } from "../../news-list/news-list";

describe("NewsFilter", () => {
  it("renders an 'All' button (pressed) plus one per category", () => {
    render(<NewsFilter categories={["Corporate", "IR"]} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Corporate" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "IR" })).toHaveAttribute("aria-pressed", "false");
  });
});

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "Corporate", title: "Corporate item", slug: "news/a" },
  { date: "2026-06-18", category: "IR", title: "IR item", slug: "news/b" },
];

describe("NewsFilter + NewsFilterEnhancer + NewsList (real ported markup, mounted together)", () => {
  it("hides non-matching rows on click and restores them via 'All'", () => {
    render(
      <div>
        <NewsList items={ITEMS} showFilter />
        <NewsFilterEnhancer />
      </div>,
    );

    expect(screen.getByText("Corporate item")).toBeVisible();
    expect(screen.getByText("IR item")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "IR" }));

    expect(screen.getByText("Corporate item").closest("li")).toHaveAttribute("hidden");
    expect(screen.getByText("IR item").closest("li")).not.toHaveAttribute("hidden");
    expect(screen.getByRole("button", { name: "IR" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(screen.getByText("Corporate item").closest("li")).not.toHaveAttribute("hidden");
    expect(screen.getByText("IR item").closest("li")).not.toHaveAttribute("hidden");
  });
});
