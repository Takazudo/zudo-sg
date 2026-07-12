import { fireEvent, render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import SearchResultsEnhancer from "../search-results-enhancer";
import { SearchResults } from "../../search-results/search-results";
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
    description: "Plans for every team size.",
    excerpt: "",
  },
];

describe("SearchResultsEnhancer", () => {
  it("renders nothing itself", () => {
    const { container } = render(<SearchResultsEnhancer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("live-filters the mounted SearchResults list as the user types", () => {
    render(
      <div>
        <SearchResults docs={DOCS} query="" />
        <SearchResultsEnhancer />
      </div>,
    );

    expect(screen.getByText("About us")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search the site");
    fireEvent.input(input, { target: { value: "pricing" } });

    expect(screen.queryByText("About us")).not.toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows the empty message when the live filter matches nothing", () => {
    render(
      <div>
        <SearchResults docs={DOCS} query="" />
        <SearchResultsEnhancer />
      </div>,
    );

    const input = screen.getByPlaceholderText("Search the site");
    fireEvent.input(input, { target: { value: "nonexistent" } });

    expect(screen.getByText(/No matching pages found/)).not.toHaveAttribute("hidden");
  });

  it("syncs the typed query into the URL's ?q= param", () => {
    render(
      <div>
        <SearchResults docs={DOCS} query="" />
        <SearchResultsEnhancer />
      </div>,
    );

    const input = screen.getByPlaceholderText("Search the site");
    fireEvent.input(input, { target: { value: "pricing" } });

    expect(new URL(window.location.href).searchParams.get("q")).toBe("pricing");
  });
});
