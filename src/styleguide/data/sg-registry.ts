// Styleguide story registry — the single story-discovery point.
//
// GENERATED FILE — the block below is codegen'd by `scripts/gen-sg-registry.mjs`
// from the `*.stories.tsx` files under packages/ui/src/*/*.stories.tsx. Never
// hand-edit between the markers; run `pnpm gen:sg-registry` after adding or
// removing a story file and commit the result. `pnpm check:sg-registry` fails
// CI on drift.
//
// DISCOVERY MECHANISM: explicit static imports (NOT import.meta.glob).
// zfb does not statically inline import.meta.glob — the literal call survives
// into the shared client islands bundle, and in the browser `import.meta.glob`
// is undefined → `.glob is not a function`. Explicit static imports produce a
// real, statically-bundled object that works identically in SSR and client
// builds. The generator globs the filesystem at codegen time, so this list
// never drifts from what's actually on disk.
//
// WHY PACKAGE PATH IMPORTS (NOT RELATIVE):
// zfb creates a shadow copy of the project root during bundling, so relative
// paths that escape the project root (e.g. ../../../../packages/ui/src/…)
// resolve outside the shadow tree and fail. Importing via `@zudo-sg/ui/src/*`
// keeps resolution within node_modules (which zfb includes in the shadow).
// The `./src/*` export wildcard in packages/ui/package.json makes this work.
//
// The consumer (`src/styleguide/data/registry.ts`) keys off the path→module
// map via `Object.entries`. Keys use a glob-relative shape
// (`./ui/src/<name>/<name>.stories.tsx`) matching the pattern the root registry
// uses, so the registry.ts logic is a direct port without key-shape changes.

// GENERATED:SG_REGISTRY_BEGIN — do not hand-edit; run `pnpm gen:sg-registry`.
import type { StoryModule } from "@zudo-sg/ui";

import * as badge from "@zudo-sg/ui/src/badge/badge.stories.tsx";
import * as button from "@zudo-sg/ui/src/button/button.stories.tsx";
import * as card from "@zudo-sg/ui/src/card/card.stories.tsx";
import * as cardsCallout from "@zudo-sg/ui/src/cards/callout/callout.stories.tsx";
import * as cardsCardGrid from "@zudo-sg/ui/src/cards/card-grid/card-grid.stories.tsx";
import * as cardsCard from "@zudo-sg/ui/src/cards/card/card.stories.tsx";
import * as chromeBreadcrumbs from "@zudo-sg/ui/src/chrome/breadcrumbs/breadcrumbs.stories.tsx";
import * as chromeContextSwitcherEnhancer from "@zudo-sg/ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer.stories.tsx";
import * as chromeMobileNavEnhancer from "@zudo-sg/ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer.stories.tsx";
import * as chromeNavEnhancer from "@zudo-sg/ui/src/chrome/nav-enhancer/nav-enhancer.stories.tsx";
import * as chromeSearchToggleEnhancer from "@zudo-sg/ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer.stories.tsx";
import * as chromeSiteFooter from "@zudo-sg/ui/src/chrome/site-footer/site-footer.stories.tsx";
import * as chromeSiteHeader from "@zudo-sg/ui/src/chrome/site-header/site-header.stories.tsx";
import * as chromeSiteNav from "@zudo-sg/ui/src/chrome/site-nav/site-nav.stories.tsx";
import * as dialog from "@zudo-sg/ui/src/dialog/dialog.stories.tsx";
import * as footer from "@zudo-sg/ui/src/footer/footer.stories.tsx";
import * as form from "@zudo-sg/ui/src/form/form.stories.tsx";
import * as heading from "@zudo-sg/ui/src/heading/heading.stories.tsx";
import * as hero from "@zudo-sg/ui/src/hero/hero.stories.tsx";
import * as link from "@zudo-sg/ui/src/link/link.stories.tsx";
import * as mediaPlaceholderBox from "@zudo-sg/ui/src/media/placeholder-box/placeholder-box.stories.tsx";
import * as sharedAutoGrid from "@zudo-sg/ui/src/shared/auto-grid/auto-grid.stories.tsx";
import * as sharedCardLink from "@zudo-sg/ui/src/shared/card-link/card-link.stories.tsx";
import * as sharedContainer from "@zudo-sg/ui/src/shared/container/container.stories.tsx";
import * as sharedCtaButton from "@zudo-sg/ui/src/shared/cta-button/cta-button.stories.tsx";
import * as sharedHero from "@zudo-sg/ui/src/shared/hero/hero.stories.tsx";
import * as sharedSectionHeading from "@zudo-sg/ui/src/shared/section-heading/section-heading.stories.tsx";
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
  "./ui/src/cards/callout/callout.stories.tsx": cardsCallout as unknown as StoryModule,
  "./ui/src/cards/card-grid/card-grid.stories.tsx": cardsCardGrid as unknown as StoryModule,
  "./ui/src/cards/card/card.stories.tsx": cardsCard as unknown as StoryModule,
  "./ui/src/chrome/breadcrumbs/breadcrumbs.stories.tsx": chromeBreadcrumbs as unknown as StoryModule,
  "./ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer.stories.tsx": chromeContextSwitcherEnhancer as unknown as StoryModule,
  "./ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer.stories.tsx": chromeMobileNavEnhancer as unknown as StoryModule,
  "./ui/src/chrome/nav-enhancer/nav-enhancer.stories.tsx": chromeNavEnhancer as unknown as StoryModule,
  "./ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer.stories.tsx": chromeSearchToggleEnhancer as unknown as StoryModule,
  "./ui/src/chrome/site-footer/site-footer.stories.tsx": chromeSiteFooter as unknown as StoryModule,
  "./ui/src/chrome/site-header/site-header.stories.tsx": chromeSiteHeader as unknown as StoryModule,
  "./ui/src/chrome/site-nav/site-nav.stories.tsx": chromeSiteNav as unknown as StoryModule,
  "./ui/src/dialog/dialog.stories.tsx": dialog as unknown as StoryModule,
  "./ui/src/footer/footer.stories.tsx": footer as unknown as StoryModule,
  "./ui/src/form/form.stories.tsx": form as unknown as StoryModule,
  "./ui/src/heading/heading.stories.tsx": heading as unknown as StoryModule,
  "./ui/src/hero/hero.stories.tsx": hero as unknown as StoryModule,
  "./ui/src/link/link.stories.tsx": link as unknown as StoryModule,
  "./ui/src/media/placeholder-box/placeholder-box.stories.tsx": mediaPlaceholderBox as unknown as StoryModule,
  "./ui/src/shared/auto-grid/auto-grid.stories.tsx": sharedAutoGrid as unknown as StoryModule,
  "./ui/src/shared/card-link/card-link.stories.tsx": sharedCardLink as unknown as StoryModule,
  "./ui/src/shared/container/container.stories.tsx": sharedContainer as unknown as StoryModule,
  "./ui/src/shared/cta-button/cta-button.stories.tsx": sharedCtaButton as unknown as StoryModule,
  "./ui/src/shared/hero/hero.stories.tsx": sharedHero as unknown as StoryModule,
  "./ui/src/shared/section-heading/section-heading.stories.tsx": sharedSectionHeading as unknown as StoryModule,
  "./ui/src/site-header/site-header.stories.tsx": siteHeader as unknown as StoryModule,
  "./ui/src/stat/stat.stories.tsx": stat as unknown as StoryModule,
};

/**
 * Per-story named-export declaration order (SOURCE order), keyed by the
 * same path as `storyModules`. registry.ts sorts each story's variants
 * by this so tabs render in authored order (and the default tab is the
 * first-authored story) instead of the alphabetical key-enumeration order
 * of the `import * as` namespace. Captured at codegen time because the
 * runtime namespace cannot recover source order (#128 / #174). Superset:
 * lists every `export const`, so registry.ts uses it only to SORT the
 * `isStory()`-filtered variants, never to gate membership.
 */
export const storyExportOrder: Record<string, string[]> = {
  "./ui/src/badge/badge.stories.tsx": ["Playground", "Soft", "Solid", "Outline"],
  "./ui/src/button/button.stories.tsx": ["Playground", "Variants", "Sizes", "AsLink", "Disabled", "Block"],
  "./ui/src/card/card.stories.tsx": ["Playground", "Variants", "WithFooter", "Linked"],
  "./ui/src/cards/callout/callout.stories.tsx": ["Default", "Tones", "WithoutTitle", "NoteAlias"],
  "./ui/src/cards/card-grid/card-grid.stories.tsx": ["Default"],
  "./ui/src/cards/card/card.stories.tsx": ["Default", "Variants", "Paddings", "BodyOnly"],
  "./ui/src/chrome/breadcrumbs/breadcrumbs.stories.tsx": ["InSection", "SectionWithoutTopLink", "TopPageRendersNothing"],
  "./ui/src/chrome/context-switcher-enhancer/context-switcher-enhancer.stories.tsx": ["Default"],
  "./ui/src/chrome/mobile-nav-enhancer/mobile-nav-enhancer.stories.tsx": ["Default"],
  "./ui/src/chrome/nav-enhancer/nav-enhancer.stories.tsx": ["Default"],
  "./ui/src/chrome/search-toggle-enhancer/search-toggle-enhancer.stories.tsx": ["Default"],
  "./ui/src/chrome/site-footer/site-footer.stories.tsx": ["Default", "FewSections", "ManySections"],
  "./ui/src/chrome/site-header/site-header.stories.tsx": ["CorporateContext", "LineContext"],
  "./ui/src/chrome/site-nav/site-nav.stories.tsx": ["Default", "ActiveSection", "SectionWithoutTopLink", "ManySections"],
  "./ui/src/dialog/dialog.stories.tsx": ["Playground", "Default", "Busy", "WithError"],
  "./ui/src/footer/footer.stories.tsx": ["Playground", "Default", "Minimal"],
  "./ui/src/form/form.stories.tsx": ["TextField", "Required", "Disabled", "ContactForm"],
  "./ui/src/heading/heading.stories.tsx": ["Playground", "Page", "Section", "SectionWithAction"],
  "./ui/src/hero/hero.stories.tsx": ["Playground", "Basic", "WithMedia", "Plain"],
  "./ui/src/link/link.stories.tsx": ["Playground", "Variants", "External"],
  "./ui/src/media/placeholder-box/placeholder-box.stories.tsx": ["Default", "AspectRatios", "Sizes", "FromMarkdownImg"],
  "./ui/src/shared/auto-grid/auto-grid.stories.tsx": ["Default", "WiderTracks", "Fill"],
  "./ui/src/shared/card-link/card-link.stories.tsx": ["Default", "ViewAll"],
  "./ui/src/shared/container/container.stories.tsx": ["Default"],
  "./ui/src/shared/cta-button/cta-button.stories.tsx": ["Playground", "Pair"],
  "./ui/src/shared/hero/hero.stories.tsx": ["Primary", "Secondary"],
  "./ui/src/shared/section-heading/section-heading.stories.tsx": ["Default", "HeadingOnly", "WithEyebrow"],
  "./ui/src/site-header/site-header.stories.tsx": ["Playground", "Default", "WithAction"],
  "./ui/src/stat/stat.stories.tsx": ["Playground", "Single", "Group", "Divided"],
};
// GENERATED:SG_REGISTRY_END
