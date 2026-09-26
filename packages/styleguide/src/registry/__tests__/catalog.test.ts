import { describe, expect, it } from "vitest";

import type { Story, StoryMeta, StoryModule } from "../../stories/types.js";
import {
  buildNavNodes,
  catalogEntriesFromDescriptors,
  catalogEntriesFromRegistry,
  createCatalog,
  createRegistry,
  validateStoryDescriptors,
  type Registry,
  type Catalog,
} from "../index.js";

function story(name: string, extra: Partial<Story> = {}): Story {
  return { name, render: () => null, ...extra };
}

function mod(title: string, category: string, stories: Record<string, Story>, extra: Partial<StoryMeta> = {}): StoryModule {
  return { default: { title, category, description: `${title} desc`, usage: "", ...extra }, ...stories };
}

const CATEGORY_ORDER = ["Data Display", "Actions"];

const modules: Record<string, StoryModule> = {
  "./button.stories.tsx": mod("Button", "Actions", {
    Zeta: story("Zeta", { controls: [{ type: "boolean", prop: "disabled", label: "Disabled", defaultValue: false }] }),
    Alpha: story("Alpha"),
  }),
  "./card.stories.tsx": mod("Card", "Data Display", { Default: story("Default") }, { order: 2 }),
  "./badge.stories.tsx": mod("Badge", "Data Display", { Default: story("Default") }, { order: 1 }),
  "./avatar.stories.tsx": mod("Avatar", "Data Display", { Default: story("Default") }),
  "./zebra.stories.tsx": mod("Zebra", "Zoo", { Default: story("Default") }),
  "./aardvark.stories.tsx": mod("Aardvark", "Animals", { Default: story("Default") }),
  // Title collides with the reserved "tokens" slug and the preview endpoint slug.
  "./tokens.stories.tsx": mod("Tokens", "Actions", { Default: story("Default") }),
  "./preview.stories.tsx": mod("Preview", "Actions", { Default: story("Default") }),
  // Meta but no stories: contributes a category to categoryOrder but no group.
  "./empty.stories.tsx": mod("Empty", "Ghost", {}),
};

const storyExportOrder = { "./button.stories.tsx": ["Zeta", "Alpha"] };

function summarize(source: Pick<Registry, "getCategoryGroups"> | Pick<Catalog, "getCategoryGroups">) {
  return source.getCategoryGroups().map((g) => ({
    category: g.category,
    slugs: g.stories.map((s: { slug: string }) => s.slug),
  }));
}

describe("catalogEntriesFromRegistry + createCatalog (module mode)", () => {
  const registry = createRegistry(modules, { categoryOrder: CATEGORY_ORDER, storyExportOrder });
  const entries = catalogEntriesFromRegistry(registry);
  const catalog = createCatalog(entries, { categoryOrder: registry.categoryOrder });

  it("maps each StoryEntry to a module CatalogEntry that keeps the original", () => {
    const button = catalog.getStoryBySlug("button");
    expect(button).toMatchObject({
      slug: "button",
      id: "./button.stories.tsx",
      path: "./button.stories.tsx",
      title: "Button",
      description: "Button desc",
      category: "Actions",
      source: "module",
      variants: [
        {
          exportName: "Zeta",
          name: "Zeta",
          controls: [{ type: "boolean", prop: "disabled", label: "Disabled", defaultValue: false }],
        },
        { exportName: "Alpha", name: "Alpha" },
      ],
    });
    expect(button?.variants[1]).not.toHaveProperty("controls");
    expect(button?.source === "module" && button.storyEntry).toBe(registry.getStoryBySlug("button"));
    expect(catalog.getStoryBySlug("card")?.order).toBe(2);
  });

  it("matches createRegistry's slugs, category order and groups", () => {
    expect(catalog.getAllSlugs()).toEqual(registry.getAllSlugs());
    expect(catalog.getAllSlugs()).toContain("tokens-2");
    expect(catalog.getAllSlugs()).toContain("preview-2");
    expect(catalog.categoryOrder).toEqual(registry.categoryOrder);
    expect(summarize(catalog)).toEqual(summarize(registry));
    expect(summarize(catalog)).toEqual([
      { category: "Data Display", slugs: ["badge", "card", "avatar"] },
      { category: "Actions", slugs: ["button", "preview-2", "tokens-2"] },
      { category: "Animals", slugs: ["aardvark"] },
      { category: "Zoo", slugs: ["zebra"] },
    ]);
  });

  it("builds nav nodes identical to the registry's", () => {
    const opts = { withBase: (p: string) => `/base${p}` };
    expect(buildNavNodes(catalog, opts)).toEqual(buildNavNodes(registry, opts));
  });

  it("derives the same order from the host's declared list alone", () => {
    const fromDeclared = createCatalog(entries, { categoryOrder: CATEGORY_ORDER });
    expect(summarize(fromDeclared)).toEqual(summarize(registry));
  });
});

describe("catalogEntriesFromDescriptors + createCatalog (descriptor mode)", () => {
  const descriptors = validateStoryDescriptors([
    {
      id: "ui/button",
      slug: "legacy_Button",
      title: "Button",
      category: "Actions",
      sourcePath: "src/button.stories.tsx",
      variants: [
        { exportName: "Zeta", name: "Zeta" },
        { exportName: "Alpha", name: "Alpha" },
      ],
      thumbnail: { kind: "placeholder", note: "pending" },
    },
    { id: "ui/card", slug: "card", title: "Card", category: "Data Display", order: 2, variants: [{ exportName: "D", name: "D" }] },
    { id: "ui/badge", slug: "badge", title: "Badge", category: "Data Display", order: 1, variants: [{ exportName: "D", name: "D" }] },
    { id: "ui/avatar", slug: "avatar", title: "Avatar", category: "Data Display", variants: [{ exportName: "D", name: "D" }] },
    { id: "ui/zebra", slug: "zebra", title: "Zebra", category: "Zoo", variants: [{ exportName: "D", name: "D" }] },
    { id: "ui/aardvark", slug: "aardvark", title: "Aardvark", category: "Animals", variants: [{ exportName: "D", name: "D" }] },
  ]);
  const catalog = createCatalog(catalogEntriesFromDescriptors(descriptors), { categoryOrder: CATEGORY_ORDER });

  it("maps descriptors verbatim with source \"descriptor\"", () => {
    expect(catalog.getStoryBySlug("legacy_Button")).toEqual({
      slug: "legacy_Button",
      id: "ui/button",
      path: "src/button.stories.tsx",
      title: "Button",
      description: "",
      category: "Actions",
      variants: [
        { exportName: "Zeta", name: "Zeta" },
        { exportName: "Alpha", name: "Alpha" },
      ],
      thumbnail: { kind: "placeholder", note: "pending" },
      source: "descriptor",
    });
    expect(catalog.getStoryBySlug("button")).toBeUndefined();
    expect(catalog.getAllSlugs()).toEqual(["legacy_Button", "card", "badge", "avatar", "zebra", "aardvark"]);
  });

  it("sorts categories and entries like createRegistry", () => {
    expect(catalog.categoryOrder).toEqual(["Data Display", "Actions", "Animals", "Zoo"]);
    expect(summarize(catalog)).toEqual([
      { category: "Data Display", slugs: ["badge", "card", "avatar"] },
      { category: "Actions", slugs: ["legacy_Button"] },
      { category: "Animals", slugs: ["aardvark"] },
      { category: "Zoo", slugs: ["zebra"] },
    ]);
  });

  it("builds nav nodes with verbatim slugs", () => {
    const nodes = buildNavNodes(catalog, { withBase: (p) => p });
    const actions = nodes.find((n) => n.slug === "category:Actions");
    expect(actions?.children).toEqual([
      { slug: "legacy_Button", label: "Button", position: 6, href: "/components/legacy_Button", hasPage: true, children: [] },
    ]);
  });

  it("rejects duplicate slugs across mixed entry lists", () => {
    const dup = catalogEntriesFromDescriptors(descriptors.slice(1, 2));
    expect(() => createCatalog([...catalogEntriesFromDescriptors(descriptors), ...dup])).toThrow(
      /\[zudo-sg\] createCatalog: duplicate slug "card"/,
    );
  });
});
