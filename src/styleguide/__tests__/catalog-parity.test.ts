// Module-mode parity (#881): the engine's mode-neutral catalog built from the
// real demo-ui registry must yield the same slugs, category groups and nav
// nodes as the registry itself, so routes can switch to it with no HTML change.

import { describe, expect, it } from "vitest";
import { buildNavNodes, catalogEntriesFromRegistry, createCatalog } from "@takazudo/zudo-sg/registry";
import { registry } from "../registry";
import { sgRouteOptions } from "../sg-route-options.mjs";

const catalog = createCatalog(catalogEntriesFromRegistry(registry), {
  categoryOrder: registry.categoryOrder,
});

describe("demo-ui catalog parity with createRegistry", () => {
  it("has the same slugs in the same order", () => {
    expect(registry.getAllSlugs().length).toBeGreaterThan(0);
    expect(catalog.getAllSlugs()).toEqual(registry.getAllSlugs());
  });

  it("has the same category groups", () => {
    const shape = (groups: Array<{ category: string; stories: Array<{ slug: string }> }>) =>
      groups.map((g) => [g.category, g.stories.map((s) => s.slug)]);
    expect(catalog.categoryOrder).toEqual(registry.categoryOrder);
    expect(shape(catalog.getCategoryGroups())).toEqual(shape(registry.getCategoryGroups()));
  });

  it("builds identical nav nodes", () => {
    const opts = { withBase: (p: string) => `/base${p}`, routes: sgRouteOptions };
    expect(buildNavNodes(catalog, opts)).toEqual(buildNavNodes(registry, opts));
  });

  it("keeps titles, descriptions and variants in step with the module entries", () => {
    for (const entry of catalog.entries) {
      const original = registry.getStoryBySlug(entry.slug);
      expect(entry.source).toBe("module");
      expect(entry.title).toBe(original?.meta.title);
      expect(entry.description).toBe(original?.meta.description);
      expect(entry.category).toBe(original?.meta.category);
      expect(entry.variants.map((v) => v.exportName)).toEqual(original?.variants.map((v) => v.exportName));
    }
  });
});
