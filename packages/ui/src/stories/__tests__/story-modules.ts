import type { StoryModule } from "../types";

// Shared story-module registry for every test in this directory
// (contract.test.ts, source-drift.test.ts, …).
//
// Explicit imports — NOT import.meta.glob. The S6 catalog discovers these via
// explicit static imports from a REPO-ROOT registry — see STORIES.md §2. We
// cannot reproduce that glob here: zfb forbids `../` parent-directory glob
// patterns, and a glob test living inside packages/ui could only reach sibling
// story files via `../`. (Confirmed: a `../**` glob in this directory breaks
// `zfb build`.) So we import every story module explicitly and share this one
// registry. The block below is codegen'd by `scripts/gen-sg-registry.mjs` from
// the `*.stories.tsx` files on disk — never hand-edit it; run
// `pnpm gen:sg-registry` and commit the result.
// GENERATED:SG_REGISTRY_BEGIN — do not hand-edit; run `pnpm gen:sg-registry`.
import * as badge from "../../badge/badge.stories";
import * as button from "../../button/button.stories";
import * as card from "../../card/card.stories";
import * as cardsCallout from "../../cards/callout/callout.stories";
import * as cardsCardGrid from "../../cards/card-grid/card-grid.stories";
import * as cardsCard from "../../cards/card/card.stories";
import * as chromeBreadcrumbs from "../../chrome/breadcrumbs/breadcrumbs.stories";
import * as chromeContextSwitcherEnhancer from "../../chrome/context-switcher-enhancer/context-switcher-enhancer.stories";
import * as chromeMobileNavEnhancer from "../../chrome/mobile-nav-enhancer/mobile-nav-enhancer.stories";
import * as chromeNavEnhancer from "../../chrome/nav-enhancer/nav-enhancer.stories";
import * as chromeSearchToggleEnhancer from "../../chrome/search-toggle-enhancer/search-toggle-enhancer.stories";
import * as chromeSiteFooter from "../../chrome/site-footer/site-footer.stories";
import * as chromeSiteHeader from "../../chrome/site-header/site-header.stories";
import * as chromeSiteNav from "../../chrome/site-nav/site-nav.stories";
import * as dialog from "../../dialog/dialog.stories";
import * as footer from "../../footer/footer.stories";
import * as form from "../../form/form.stories";
import * as heading from "../../heading/heading.stories";
import * as hero from "../../hero/hero.stories";
import * as link from "../../link/link.stories";
import * as mediaPlaceholderBox from "../../media/placeholder-box/placeholder-box.stories";
import * as sharedAutoGrid from "../../shared/auto-grid/auto-grid.stories";
import * as sharedCardLink from "../../shared/card-link/card-link.stories";
import * as sharedContainer from "../../shared/container/container.stories";
import * as sharedCtaButton from "../../shared/cta-button/cta-button.stories";
import * as sharedHero from "../../shared/hero/hero.stories";
import * as sharedSectionHeading from "../../shared/section-heading/section-heading.stories";
import * as siteHeader from "../../site-header/site-header.stories";
import * as stat from "../../stat/stat.stories";

export const STORY_MODULES: Record<string, StoryModule> = {
  "badge/badge.stories.tsx": badge as unknown as StoryModule,
  "button/button.stories.tsx": button as unknown as StoryModule,
  "card/card.stories.tsx": card as unknown as StoryModule,
  "cards/callout/callout.stories.tsx": cardsCallout as unknown as StoryModule,
  "cards/card-grid/card-grid.stories.tsx": cardsCardGrid as unknown as StoryModule,
  "cards/card/card.stories.tsx": cardsCard as unknown as StoryModule,
  "chrome/breadcrumbs/breadcrumbs.stories.tsx": chromeBreadcrumbs as unknown as StoryModule,
  "chrome/context-switcher-enhancer/context-switcher-enhancer.stories.tsx": chromeContextSwitcherEnhancer as unknown as StoryModule,
  "chrome/mobile-nav-enhancer/mobile-nav-enhancer.stories.tsx": chromeMobileNavEnhancer as unknown as StoryModule,
  "chrome/nav-enhancer/nav-enhancer.stories.tsx": chromeNavEnhancer as unknown as StoryModule,
  "chrome/search-toggle-enhancer/search-toggle-enhancer.stories.tsx": chromeSearchToggleEnhancer as unknown as StoryModule,
  "chrome/site-footer/site-footer.stories.tsx": chromeSiteFooter as unknown as StoryModule,
  "chrome/site-header/site-header.stories.tsx": chromeSiteHeader as unknown as StoryModule,
  "chrome/site-nav/site-nav.stories.tsx": chromeSiteNav as unknown as StoryModule,
  "dialog/dialog.stories.tsx": dialog as unknown as StoryModule,
  "footer/footer.stories.tsx": footer as unknown as StoryModule,
  "form/form.stories.tsx": form as unknown as StoryModule,
  "heading/heading.stories.tsx": heading as unknown as StoryModule,
  "hero/hero.stories.tsx": hero as unknown as StoryModule,
  "link/link.stories.tsx": link as unknown as StoryModule,
  "media/placeholder-box/placeholder-box.stories.tsx": mediaPlaceholderBox as unknown as StoryModule,
  "shared/auto-grid/auto-grid.stories.tsx": sharedAutoGrid as unknown as StoryModule,
  "shared/card-link/card-link.stories.tsx": sharedCardLink as unknown as StoryModule,
  "shared/container/container.stories.tsx": sharedContainer as unknown as StoryModule,
  "shared/cta-button/cta-button.stories.tsx": sharedCtaButton as unknown as StoryModule,
  "shared/hero/hero.stories.tsx": sharedHero as unknown as StoryModule,
  "shared/section-heading/section-heading.stories.tsx": sharedSectionHeading as unknown as StoryModule,
  "site-header/site-header.stories.tsx": siteHeader as unknown as StoryModule,
  "stat/stat.stories.tsx": stat as unknown as StoryModule,
};
// GENERATED:SG_REGISTRY_END
