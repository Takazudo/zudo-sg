import { describe, expect, it } from "vitest";

import type { Story, StoryMeta, StoryModule } from "../../stories/types.js";
import { computeCategoryOrder, createRegistry, OVERVIEW_SLUG, slugify, TOKENS_SLUG } from "../registry.js";

function story(name: string): Story {
  return { name, render: () => null };
}

function meta(title: string, category: string, extra: Partial<StoryMeta> = {}): StoryMeta {
  return { title, category, description: "", usage: "", ...extra };
}

function mod(m: StoryMeta, stories: Record<string, Story>): StoryModule {
  return { default: m, ...stories };
}

const modules: Record<string, StoryModule> = {
  "./ui/src/button/button.stories.tsx": mod(meta("Button", "Actions"), {
    Zeta: story("Zeta"),
    Alpha: story("Alpha"),
  }),
  "./ui/src/card/card.stories.tsx": mod(meta("Card", "Data Display", { order: 2 }), {
    Default: story("Default"),
  }),
  "./ui/src/badge/badge.stories.tsx": mod(meta("Badge", "Data Display", { order: 1 }), {
    Default: story("Default"),
  }),
  "./ui/src/zebra/zebra.stories.tsx": mod(meta("Zebra", "Zoo"), { Default: story("Default") }),
  "./ui/src/aardvark/aardvark.stories.tsx": mod(meta("Aardvark", "Animals"), {
    Default: story("Default"),
  }),
};

describe("computeCategoryOrder", () => {
  it("keeps the declared order first and appends unlisted used categories alphabetically", () => {
    expect(computeCategoryOrder(modules, ["Data Display", "Actions", "Empty"])).toEqual([
      "Data Display",
      "Actions",
      "Empty",
      "Animals",
      "Zoo",
    ]);
  });

  it("dedupes the declared list and works with no declared order", () => {
    expect(computeCategoryOrder(modules, ["Actions", "Actions"])).toEqual([
      "Actions",
      "Animals",
      "Data Display",
      "Zoo",
    ]);
    expect(computeCategoryOrder({}, undefined)).toEqual([]);
  });
});

describe("createRegistry", () => {
  const registry = createRegistry(modules, {
    categoryOrder: ["Actions", "Data Display"],
    storyExportOrder: { "./ui/src/button/button.stories.tsx": ["Zeta", "Alpha"] },
  });

  it("groups by categoryOrder, sorts by meta.order then title, omits empty categories", () => {
    expect(
      registry.getCategoryGroups().map((g) => [g.category, g.stories.map((s) => s.meta.title)]),
    ).toEqual([
      ["Actions", ["Button"]],
      ["Data Display", ["Badge", "Card"]],
      ["Animals", ["Aardvark"]],
      ["Zoo", ["Zebra"]],
    ]);
  });

  it("orders variants by storyExportOrder (source order), not namespace key order", () => {
    const button = registry.getStoryBySlug("button");
    expect(button?.variants.map((v) => v.exportName)).toEqual(["Zeta", "Alpha"]);
  });

  it("sorts exports unknown to storyExportOrder after known ones, stably", () => {
    const r = createRegistry({
      "./x.stories.tsx": mod(meta("X", "A"), { B: story("B"), C: story("C"), A: story("A") }),
    }, { storyExportOrder: { "./x.stories.tsx": ["C"] } });
    expect(r.getStoryBySlug("x")?.variants.map((v) => v.exportName)).toEqual(["C", "B", "A"]);
  });

  it("skips modules without valid meta or without Story exports", () => {
    const r = createRegistry({
      "./no-meta.stories.tsx": { default: undefined } as unknown as StoryModule,
      "./no-stories.stories.tsx": { default: meta("Lonely", "A"), helper: 1 } as unknown as StoryModule,
      "./ok.stories.tsx": mod(meta("Ok", "A"), { Default: story("Default") }),
    });
    expect(r.getAllSlugs()).toEqual(["ok"]);
  });

  it("reserves chrome slugs and de-dupes colliding titles", () => {
    const r = createRegistry({
      "./a.stories.tsx": mod(meta("Tokens", "A"), { Default: story("Default") }),
      "./b.stories.tsx": mod(meta("Button", "A"), { Default: story("Default") }),
      "./c.stories.tsx": mod(meta("Button", "B"), { Default: story("Default") }),
    });
    expect(OVERVIEW_SLUG).toBe("");
    expect(TOKENS_SLUG).toBe("tokens");
    expect(r.getAllSlugs()).toEqual(["tokens-2", "button", "button-2"]);
  });

  it("exposes lookups that survive destructuring", () => {
    const { getStoryBySlug, getAllSlugs, categoryOrder } = registry;
    expect(getStoryBySlug("card")?.path).toBe("./ui/src/card/card.stories.tsx");
    expect(getStoryBySlug("missing")).toBeUndefined();
    expect(getAllSlugs()).toHaveLength(5);
    expect(categoryOrder).toEqual(["Actions", "Data Display", "Animals", "Zoo"]);
  });
});

describe("slugify", () => {
  it("kebab-cases titles", () => {
    expect(slugify("CtaButton")).toBe("cta-button");
    expect(slugify("  Site Header ")).toBe("site-header");
    expect(slugify("Prose H2")).toBe("prose-h2");
  });
});
