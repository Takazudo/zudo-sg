import { describe, expect, it } from "vitest";
import type { StoryMeta, Story, StoryCategory, StoryModule } from "../types";

// Explicit imports — NOT import.meta.glob.
//
// The S6 catalog discovers these via explicit static imports from a
// REPO-ROOT registry — see STORIES.md §2. We cannot reproduce that with a
// glob here: zfb forbids `../` parent-directory glob patterns, and a glob
// test living inside packages/ui could only reach sibling story files via
// `../`. (Confirmed: a `../**` glob in this directory breaks `zfb build`.) So
// instead we import every story module explicitly and assert each satisfies
// the documented contract shape. The block below is codegen'd by
// `scripts/gen-sg-registry.mjs` from the `*.stories.tsx` files on disk — never
// hand-edit it; run `pnpm gen:sg-registry` and commit the result.
// GENERATED:SG_REGISTRY_BEGIN — do not hand-edit; run `pnpm gen:sg-registry`.
import * as badge from "../../badge/badge.stories";
import * as button from "../../button/button.stories";
import * as card from "../../card/card.stories";
import * as footer from "../../footer/footer.stories";
import * as form from "../../form/form.stories";
import * as heading from "../../heading/heading.stories";
import * as hero from "../../hero/hero.stories";
import * as link from "../../link/link.stories";
import * as siteHeader from "../../site-header/site-header.stories";
import * as stat from "../../stat/stat.stories";

const STORY_MODULES: Record<string, StoryModule> = {
  "badge/badge.stories.tsx": badge as unknown as StoryModule,
  "button/button.stories.tsx": button as unknown as StoryModule,
  "card/card.stories.tsx": card as unknown as StoryModule,
  "footer/footer.stories.tsx": footer as unknown as StoryModule,
  "form/form.stories.tsx": form as unknown as StoryModule,
  "heading/heading.stories.tsx": heading as unknown as StoryModule,
  "hero/hero.stories.tsx": hero as unknown as StoryModule,
  "link/link.stories.tsx": link as unknown as StoryModule,
  "site-header/site-header.stories.tsx": siteHeader as unknown as StoryModule,
  "stat/stat.stories.tsx": stat as unknown as StoryModule,
};
// GENERATED:SG_REGISTRY_END

const VALID_CATEGORIES: StoryCategory[] = [
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
];

const entries = Object.entries(STORY_MODULES);

describe("story-authoring contract", () => {
  for (const [path, mod] of entries) {
    describe(path, () => {
      const meta = mod.default as StoryMeta | undefined;

      it("default-exports a valid StoryMeta", () => {
        expect(meta, "missing default meta export").toBeTruthy();
        expect(typeof meta?.title).toBe("string");
        expect(meta?.title.length).toBeGreaterThan(0);
        expect(VALID_CATEGORIES).toContain(meta?.category);
        expect(typeof meta?.description).toBe("string");
        expect(meta?.description.length).toBeGreaterThan(0);
        expect(typeof meta?.usage).toBe("string");
        expect(meta?.usage.length).toBeGreaterThan(0);
      });

      it("has at least one named Story export, each well-formed", () => {
        const stories = Object.entries(mod).filter(([name]) => name !== "default");
        expect(stories.length).toBeGreaterThan(0);
        for (const [name, value] of stories) {
          const story = value as Story;
          expect(typeof story.name, `${name}.name`).toBe("string");
          expect(typeof story.render, `${name}.render`).toBe("function");
          // render must be synchronous + produce a node (pure, no throw).
          const node = story.render();
          expect(node, `${name}.render() returned nullish`).toBeDefined();
        }
      });
    });
  }
});
