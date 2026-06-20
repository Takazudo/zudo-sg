// Styleguide story registry — the single story-discovery point.
//
// DISCOVERY MECHANISM (S6 rung #1 → S9 switched to rung #2: explicit static
// imports). The eager `import.meta.glob` path worked at SSR but zfb expands it
// at SSR-render time only — it does NOT statically inline the map — so the
// literal `import.meta.glob(...)` call survived into the shared **client**
// islands bundle. The preview iframe app (`src/styleguide/preview/preview-app.tsx`)
// is a `"use client"` island that imports this registry, and that bundle loads
// on every page that ships any island (including the docs home `/`). In the
// browser `import.meta.glob` is undefined → `.glob is not a function`, which
// broke the home-page smoke test.
//
// Explicit static imports produce a real, statically-bundled object identical
// in SSR and client builds — the preview island now works client-side and no
// glob call leaks. With only ~10 story files this is trivial to maintain by
// hand (rung #2 without the codegen script); if the set grows large, port
// zzmod's `scripts/generate-story-glob.mjs` to regenerate the block below.
//
// The consumer (`src/styleguide/data/registry.ts`) keys off the path→module map
// via `Object.entries`, so the keys keep the original glob-relative shape
// (`./ui/src/<name>/<name>.stories.tsx`) and each value is the module namespace
// (`{ default: meta, ...named Story exports }`).

import type { StoryModule } from "@zudo-sg/ui";

import * as badge from "./ui/src/badge/badge.stories";
import * as button from "./ui/src/button/button.stories";
import * as card from "./ui/src/card/card.stories";
import * as footer from "./ui/src/footer/footer.stories";
import * as form from "./ui/src/form/form.stories";
import * as heading from "./ui/src/heading/heading.stories";
import * as hero from "./ui/src/hero/hero.stories";
import * as link from "./ui/src/link/link.stories";
import * as siteHeader from "./ui/src/site-header/site-header.stories";
import * as stat from "./ui/src/stat/stat.stories";

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
