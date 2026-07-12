import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { NewsTeaser } from "../news-teaser";
import type { NewsItem } from "../../news-list/news-list";

const ITEMS: NewsItem[] = [
  { date: "2026-06-19", category: "IR", title: "Earnings notice", slug: "news/ir-1" },
];

describe("NewsTeaser", () => {
  it("renders the heading, a view-all link, and the feed rows", () => {
    render(<NewsTeaser heading="IR News" items={ITEMS} viewAllHref="/ir/news" />);
    expect(screen.getByRole("heading", { name: "IR News" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute("href", "/ir/news");
    expect(screen.getByText("Earnings notice")).toBeInTheDocument();
  });

  it("uses a custom view-all label when provided", () => {
    render(
      <NewsTeaser heading="News" items={ITEMS} viewAllHref="/news" viewAllLabel="See everything" />,
    );
    expect(screen.getByRole("link", { name: /See everything/ })).toBeInTheDocument();
  });

  it("renders no filter bar (always showFilter=false on the underlying NewsList)", () => {
    render(<NewsTeaser heading="News" items={ITEMS} viewAllHref="/news" />);
    expect(screen.queryByRole("group", { name: "Filter by category" })).not.toBeInTheDocument();
  });
});
