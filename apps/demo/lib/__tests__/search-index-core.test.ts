import { describe, expect, it } from "vitest";
import { buildSearchIndex, toPlainText } from "../search-index-core";

describe("toPlainText", () => {
  it("drops fenced code blocks and images", () => {
    expect(toPlainText("before\n```js\ncode\n```\nafter ![alt](img.png)")).toBe("before after");
  });

  it("keeps a link's display text", () => {
    expect(toPlainText("see [the docs](https://example.com) for more")).toBe(
      "see the docs for more",
    );
  });

  it("strips heading/quote marks and emphasis punctuation", () => {
    expect(toPlainText("## Heading\n> quoted *emphasis* and `code`")).toBe(
      "Heading quoted emphasis and code",
    );
  });
});

describe("buildSearchIndex", () => {
  it("derives title/href/section/description/excerpt per entry", () => {
    const docs = buildSearchIndex([
      {
        slug: "company/about",
        data: { title: "About Us", section: "Company", description: "Who we are." },
        body: "Some long body text about the company history and mission.",
      },
    ]);

    expect(docs).toEqual([
      {
        title: "About Us",
        href: "/company/about",
        section: "Company",
        description: "Who we are.",
        excerpt: "Some long body text about the company history and mission.",
      },
    ]);
  });

  it("falls back to the slug's last segment when title is absent", () => {
    const docs = buildSearchIndex([{ slug: "news/press-release", data: {}, body: "" }]);
    expect(docs[0]?.title).toBe("press release");
  });

  it("includes navHidden entries (unlike the nav tree)", () => {
    const docs = buildSearchIndex([
      { slug: "news/2024-01", data: { title: "January update", navHidden: true }, body: "" },
    ]);
    expect(docs.map((d) => d.title)).toEqual(["January update"]);
  });

  it("sorts by title", () => {
    const docs = buildSearchIndex([
      { slug: "b", data: { title: "Zebra" }, body: "" },
      { slug: "a", data: { title: "Apple" }, body: "" },
    ]);
    expect(docs.map((d) => d.title)).toEqual(["Apple", "Zebra"]);
  });

  it("truncates a long excerpt with an ellipsis", () => {
    const longBody = "word ".repeat(60).trim();
    const docs = buildSearchIndex([{ slug: "x", data: {}, body: longBody }]);
    expect(docs[0]?.excerpt.length).toBeLessThanOrEqual(161);
    expect(docs[0]?.excerpt.endsWith("…")).toBe(true);
  });
});
