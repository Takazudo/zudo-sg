import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { SearchResults } from "../search-results";
import type { SearchDoc } from "../../search-doc";

const DOCS: SearchDoc[] = [
  {
    title: "About us",
    href: "/about",
    section: "Company",
    description: "Our mission and team.",
    excerpt: "",
  },
  {
    title: "Pricing",
    href: "/pricing",
    section: "Product",
    description: "",
    excerpt: "Plans for every team size.",
  },
];

describe("SearchResults", () => {
  it("renders one row per doc when the query is empty", () => {
    render(<SearchResults docs={DOCS} query="" />);
    expect(screen.getByText("About us")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("SSR-filters the list by the query prop", () => {
    render(<SearchResults docs={DOCS} query="pricing" />);
    expect(screen.queryByText("About us")).not.toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("shows the empty message and hides the list when nothing matches", () => {
    render(<SearchResults docs={DOCS} query="nonexistent" />);
    expect(screen.getByText(/No matching pages found/)).not.toHaveAttribute("hidden");
    expect(screen.queryByText("About us")).not.toBeInTheDocument();
  });

  it("embeds the full (unfiltered) doc set as JSON for the enhancer", () => {
    const { container } = render(<SearchResults docs={DOCS} query="pricing" />);
    const script = container.querySelector('[data-search-index]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.textContent ?? "[]");
    expect(parsed).toHaveLength(2);
  });

  it("falls back to description over excerpt, and renders excerpt when description is empty", () => {
    render(<SearchResults docs={DOCS} query="" />);
    expect(screen.getByText("Our mission and team.")).toBeInTheDocument();
    expect(screen.getByText("Plans for every team size.")).toBeInTheDocument();
  });
});
