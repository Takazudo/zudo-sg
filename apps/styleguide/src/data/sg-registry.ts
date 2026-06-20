// Styleguide story registry — the single story-discovery point.
//
// DISCOVERY MECHANISM: explicit static imports (NOT import.meta.glob).
// zfb does not statically inline import.meta.glob — the literal call survives
// into the shared client islands bundle, and in the browser `import.meta.glob`
// is undefined → `.glob is not a function`. Explicit static imports produce a
// real, statically-bundled object that works identically in SSR and client
// builds. With only 10 story files this is trivial to maintain by hand.
//
// WHY PACKAGE PATH IMPORTS (NOT RELATIVE):
// zfb creates a shadow copy of the project root during bundling, so relative
// paths that escape the project root (e.g. ../../../../packages/ui/src/…)
// resolve outside the shadow tree and fail. Importing via `@zudo-sg/ui/src/*`
// keeps resolution within node_modules (which zfb includes in the shadow).
// The `./src/*` export wildcard in packages/ui/package.json makes this work.
//
// The consumer (`apps/styleguide/src/data/registry.ts`) keys off the path→module
// map via `Object.entries`. Keys use a glob-relative shape
// (`./ui/src/<name>/<name>.stories.tsx`) matching the pattern the root registry
// uses, so the registry.ts logic is a direct port without key-shape changes.

import type { StoryModule } from "@zudo-sg/ui";

import * as badge from "@zudo-sg/ui/src/badge/badge.stories.tsx";
import * as button from "@zudo-sg/ui/src/button/button.stories.tsx";
import * as card from "@zudo-sg/ui/src/card/card.stories.tsx";
import * as footer from "@zudo-sg/ui/src/footer/footer.stories.tsx";
import * as form from "@zudo-sg/ui/src/form/form.stories.tsx";
import * as heading from "@zudo-sg/ui/src/heading/heading.stories.tsx";
import * as hero from "@zudo-sg/ui/src/hero/hero.stories.tsx";
import * as link from "@zudo-sg/ui/src/link/link.stories.tsx";
import * as siteHeader from "@zudo-sg/ui/src/site-header/site-header.stories.tsx";
import * as stat from "@zudo-sg/ui/src/stat/stat.stories.tsx";

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
