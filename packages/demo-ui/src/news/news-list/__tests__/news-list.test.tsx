import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { NewsList, type NewsItem } from "../news-list";

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "Sustainability", title: "First item", slug: "news/first" },
  { date: "2026-05-08", category: "Products", title: "Second item (external)", slug: "news/second", href: "https://example.com/x" },
];

describe("NewsList", () => {
  it("renders a row per item with a formatted date and category badge", () => {
    render(<NewsList items={ITEMS} />);
    expect(screen.getByText("First item")).toBeInTheDocument();
    expect(screen.getByText("2026.06.19")).toBeInTheDocument();
    expect(screen.getByText("Sustainability")).toBeInTheDocument();
  });

  it("links to /<slug> when href is absent, and to href when present", () => {
    render(<NewsList items={ITEMS} />);
    expect(screen.getByText("First item").closest("a")).toHaveAttribute("href", "/news/first");
    expect(screen.getByText("Second item (external)").closest("a")).toHaveAttribute(
      "href",
      "https://example.com/x",
    );
  });

  it("shows an empty-state message when there are no items", () => {
    render(<NewsList items={[]} />);
    expect(screen.getByText("There are no news items yet.")).toBeInTheDocument();
  });

  it("renders the heading only when provided", () => {
    const { rerender } = render(<NewsList items={ITEMS} heading="News" />);
    expect(screen.getByRole("heading", { name: "News" })).toBeInTheDocument();
    rerender(<NewsList items={ITEMS} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the filter bar only when showFilter is set and there is more than one category", () => {
    const { rerender } = render(<NewsList items={ITEMS} showFilter />);
    expect(screen.getByRole("group", { name: "Filter by category" })).toBeInTheDocument();
    rerender(<NewsList items={[ITEMS[0]]} showFilter />);
    expect(screen.queryByRole("group", { name: "Filter by category" })).not.toBeInTheDocument();
  });
});
