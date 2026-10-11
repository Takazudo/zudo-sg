import { beforeEach, describe, expect, it } from "vitest";
import { fire, flushAll, getByText, renderIsland } from "../../../test-utils/zudo-react.js";
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
    description: "",
    excerpt: "",
  },
];

function SearchResultsFixture({ query }: { query: string }) {
  return (
    <div>
      <SearchResults docs={DOCS} query={query} />
      <SearchResultsEnhancer />
    </div>
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("SearchResultsEnhancer", () => {
  it("renders nothing itself", () => {
    const app = renderIsland(SearchResultsEnhancer, {});

    expect(app.container.children).toHaveLength(0);
    expect(app.container.textContent).toBe("");
  });

  it("live-filters the SSR SearchResults list as the user types", async () => {
    const app = renderIsland(SearchResultsFixture, { query: "" });
    const input = app.container.querySelector("[data-search-input]") as HTMLInputElement;
    const list = app.container.querySelector("[data-search-list]") as HTMLElement;

    expect(getByText(list, "About us")).toBeTruthy();
    expect(getByText(app.container, "Pricing")).toBeTruthy();

    input.value = "pricing";
    fire(input, "input");
    await flushAll();

    expect(list.textContent).not.toContain("About us");
    expect(getByText(app.container, "Pricing")).toBeTruthy();
    expect(app.container.querySelector("[data-search-count]")?.textContent).toBe("1");
  });

  it("shows the empty message when the live filter matches nothing", async () => {
    const app = renderIsland(SearchResultsFixture, { query: "" });
    const input = app.container.querySelector("[data-search-input]") as HTMLInputElement;

    input.value = "nonexistent";
    fire(input, "input");
    await flushAll();

    expect((app.container.querySelector("[data-search-empty]") as HTMLElement).hidden).toBe(false);
  });

  it("syncs the typed query into the URL's ?q= param", async () => {
    const app = renderIsland(SearchResultsFixture, { query: "" });
    const input = app.container.querySelector("[data-search-input]") as HTMLInputElement;

    input.value = "pricing";
    fire(input, "input");
    await flushAll();

    expect(new URL(window.location.href).searchParams.get("q")).toBe("pricing");
  });

  it("removes the input handler on disposal", async () => {
    const app = renderIsland(SearchResultsFixture, { query: "" });
    const input = app.container.querySelector("[data-search-input]") as HTMLInputElement;
    const list = app.container.querySelector("[data-search-list]") as HTMLElement;
    const originalHtml = list.innerHTML;

    app.dispose();
    input.value = "pricing";
    fire(input, "input");
    await flushAll();

    expect(list.innerHTML).toBe(originalHtml);
    expect(app.container.isConnected).toBe(false);
  });
});
