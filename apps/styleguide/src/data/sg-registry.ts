// Styleguide story registry — the single story-discovery point.
//
// DISCOVERY MECHANISM: explicit static imports (NOT import.meta.glob).
// zfb does not statically inline import.meta.glob — the literal call survives
// into the shared client islands bundle, and in the browser `import.meta.glob`
// is undefined → `.glob is not a function`. Explicit static imports produce a
// real, statically-bundled object that works identically in SSR and client
// builds. With only 10 story files this is trivial to maintain by hand.
//
// @zudo-sg/ui does NOT export *.stories.tsx from its package `exports`, so
// imports must use relative source paths rather than the package's public API.
//
// The consumer (`apps/styleguide/src/data/registry.ts`) keys off the path→module
// map via `Object.entries`. Keys use a glob-relative shape
// (`./ui/src/<name>/<name>.stories.tsx`) matching the pattern the root registry
// uses, so the registry.ts logic is a direct port without key-shape changes.

import type { StoryModule } from "@zudo-sg/ui";

import * as badge from "../../../../packages/ui/src/badge/badge.stories";
import * as button from "../../../../packages/ui/src/button/button.stories";
import * as card from "../../../../packages/ui/src/card/card.stories";
import * as footer from "../../../../packages/ui/src/footer/footer.stories";
import * as form from "../../../../packages/ui/src/form/form.stories";
import * as heading from "../../../../packages/ui/src/heading/heading.stories";
import * as hero from "../../../../packages/ui/src/hero/hero.stories";
import * as link from "../../../../packages/ui/src/link/link.stories";
import * as siteHeader from "../../../../packages/ui/src/site-header/site-header.stories";
import * as stat from "../../../../packages/ui/src/stat/stat.stories";

/**
 * Path → story module map. Keys are glob-relative (e.g.
 * `./ui/src/button/button.stories.tsx`). Each module is
 * `{ default: meta, ...named Story exports }`.
 */
export const storyModules: Record<string, StoryModule> = {
  "./ui/src/badge/badge.stories.tsx": badge as unknown as StoryModule,
  "./ui/src/button/button.stories.tsx": button as unknown as StoryModule,
  "./ui/src/card/card.stories.tsx": card as unknown as StoryModule,
  "./ui/src/footer/footer.stories.tsx": footer as unknown as StoryModule,
  "./ui/src/form/form.stories.tsx": form as unknown as StoryModule,
  "./ui/src/heading/heading.stories.tsx": heading as unknown as StoryModule,
  "./ui/src/hero/hero.stories.tsx": hero as unknown as StoryModule,
  "./ui/src/link/link.stories.tsx": link as unknown as StoryModule,
  "./ui/src/site-header/site-header.stories.tsx": siteHeader as unknown as StoryModule,
  "./ui/src/stat/stat.stories.tsx": stat as unknown as StoryModule,
};
