import { describe, expect, it } from "vitest";
import { getByText, renderIsland } from "../../../test-utils/zudo-react.js";
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
    const app = renderIsland(SearchResults, { docs: DOCS, query: "" });

    expect(getByText(app.container, "About us")).toBeTruthy();
    expect(getByText(app.container, "Pricing")).toBeTruthy();
    expect(getByText(app.container, "2").getAttribute("data-search-count")).not.toBeNull();
  });

  it("SSR-filters the list by the query prop", () => {
    const app = renderIsland(SearchResults, { docs: DOCS, query: "pricing" });
    const list = app.container.querySelector("[data-search-list]") as HTMLElement;

    expect(list.textContent).not.toContain("About us");
    expect(getByText(app.container, "Pricing")).toBeTruthy();
  });

  it("shows the empty message and hides the list when nothing matches", () => {
    const app = renderIsland(SearchResults, { docs: DOCS, query: "nonexistent" });
    const empty = app.container.querySelector("[data-search-empty]") as HTMLElement;
    const list = app.container.querySelector("[data-search-list]") as HTMLElement;

    expect(empty.hidden).toBe(false);
    expect(list.textContent).not.toContain("About us");
  });

  it("embeds the full (unfiltered) doc set as JSON for the enhancer", () => {
    const app = renderIsland(SearchResults, { docs: DOCS, query: "pricing" });
    const script = app.container.querySelector("[data-search-index]");

    expect(script).not.toBeNull();
    expect(JSON.parse(script?.textContent ?? "[]")).toHaveLength(2);
  });

  it("escapes script-closing text in the embedded JSON", () => {
    const docs = [{ ...DOCS[0]!, title: "</script><script>window.injected=true</script>" }];
    const app = renderIsland(SearchResults, { docs, query: "no matching result" });
    const script = app.container.querySelector("[data-search-index]");

    expect(app.container.querySelectorAll("script")).toHaveLength(1);
    expect(JSON.parse(script?.textContent ?? "[]")[0].title).toBe(docs[0]?.title);
    expect(app.container.querySelector("[data-search-list]")?.children).toHaveLength(0);
  });

  it("falls back to description over excerpt, and renders excerpt when description is empty", () => {
    const app = renderIsland(SearchResults, { docs: DOCS, query: "" });

    expect(getByText(app.container, "Our mission and team.")).toBeTruthy();
    expect(getByText(app.container, "Plans for every team size.")).toBeTruthy();
  });
});
