// Host integration coverage for #651: the root host's registry instance feeds
// zudo-sg's own declared STORY_CATEGORIES as `categoryOrder` into the engine's
// createRegistry. The ordering rules themselves (including "unlisted
// categories append alphabetically") are unit-tested in the engine package
// (packages/styleguide/src/registry/__tests__/registry.test.ts); this guards
// the real registry's sidebar order.

import { describe, expect, it } from "vitest";
import { STORY_CATEGORIES } from "@zudo-sg/demo-ui";
import { CATEGORY_ORDER, getCategoryGroups } from "../registry";

describe("CATEGORY_ORDER", () => {
  it("starts with zudo-sg's own declared STORY_CATEGORIES order", () => {
    expect(CATEGORY_ORDER.slice(0, STORY_CATEGORIES.length)).toEqual([
      ...STORY_CATEGORIES,
    ]);
  });

  it("has no duplicate entries", () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
  });

  it("every category present in the real registry appears in CATEGORY_ORDER", () => {
    const usedCategories = new Set(
      getCategoryGroups().map((group) => group.category),
    );
    for (const category of usedCategories) {
      expect(CATEGORY_ORDER).toContain(category);
    }
  });
});

describe("getCategoryGroups", () => {
  it("renders groups in CATEGORY_ORDER order (sidebar order unchanged)", () => {
    const groups = getCategoryGroups();
    const orderIndex = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
    const indices = groups.map((g) => orderIndex.get(g.category) ?? -1);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("omits empty categories", () => {
    for (const group of getCategoryGroups()) {
      expect(group.stories.length).toBeGreaterThan(0);
    }
  });
});
