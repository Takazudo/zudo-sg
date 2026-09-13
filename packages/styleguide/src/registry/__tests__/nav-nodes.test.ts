import { describe, expect, it } from "vitest";

import type { StoryModule } from "../../stories/types.js";
import { buildNavNodes } from "../nav-nodes.js";
import { createRegistry } from "../registry.js";

const registry = createRegistry(
  {
    "./a.stories.tsx": {
      default: { title: "Button", category: "Actions", description: "", usage: "" },
      Default: { name: "Default", render: () => null },
    },
    "./b.stories.tsx": {
      default: { title: "Card", category: "Cards", description: "", usage: "" },
      Default: { name: "Default", render: () => null },
    },
  } satisfies Record<string, StoryModule>,
  { categoryOrder: ["Actions"] },
);

describe("buildNavNodes", () => {
  it("builds an overview leaf, one parent per category and a leaf per story", () => {
    const nodes = buildNavNodes(registry, { withBase: (p) => `/base${p}` });
    expect(nodes).toEqual([
      { slug: "", label: "Overview", position: 0, href: "/base/components", hasPage: true, children: [] },
      {
        slug: "category:Actions",
        label: "Actions",
        position: 1,
        hasPage: false,
        children: [
          { slug: "button", label: "Button", position: 2, href: "/base/components/button", hasPage: true, children: [] },
        ],
      },
      {
        slug: "category:Cards",
        label: "Cards",
        position: 3,
        hasPage: false,
        children: [
          { slug: "card", label: "Card", position: 4, href: "/base/components/card", hasPage: true, children: [] },
        ],
      },
    ]);
  });

  it("builds hrefs from custom route patterns", () => {
    const nodes = buildNavNodes(registry, {
      withBase: (p) => p,
      routes: { componentsIndex: "/sg", componentsSlug: "/sg/c/[slug]" },
      overviewLabel: "All",
    });
    expect(nodes[0]).toMatchObject({ label: "All", href: "/sg" });
    expect(nodes[1]?.children[0]?.href).toBe("/sg/c/button");
  });
});
