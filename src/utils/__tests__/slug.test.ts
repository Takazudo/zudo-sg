import { describe, expect, it } from "vitest";
import { toRouteSlug, toHistorySlug, toSlugParams, toTitleCase } from "../slug";

describe("toRouteSlug", () => {
  it('converts bare root "index" to empty string', () => {
    expect(toRouteSlug("index")).toBe("");
  });

  it('converts "x/index" to "x"', () => {
    expect(toRouteSlug("x/index")).toBe("x");
  });

  it("leaves non-index slugs unchanged", () => {
    expect(toRouteSlug("getting-started")).toBe("getting-started");
    expect(toRouteSlug("docs/intro")).toBe("docs/intro");
  });
});

describe("toHistorySlug", () => {
  it('converts empty string (root) to "index"', () => {
    expect(toHistorySlug("")).toBe("index");
  });

  it("leaves non-empty slugs unchanged", () => {
    expect(toHistorySlug("getting-started")).toBe("getting-started");
  });
});

describe("toSlugParams", () => {
  it("converts empty string (root) to empty array", () => {
    expect(toSlugParams("")).toEqual([]);
  });

  it("splits non-empty slugs on /", () => {
    expect(toSlugParams("a/b/c")).toEqual(["a", "b", "c"]);
  });
});

describe("toTitleCase", () => {
  it("capitalizes each hyphen-separated word", () => {
    expect(toTitleCase("getting-started")).toBe("Getting Started");
    expect(toTitleCase("hello-world")).toBe("Hello World");
  });
});
