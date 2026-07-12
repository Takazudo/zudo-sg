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
import * as contentProseA from "@zudo-sg/ui/src/content/prose-a/prose-a.stories.tsx";
import * as contentProseBlockquote from "@zudo-sg/ui/src/content/prose-blockquote/prose-blockquote.stories.tsx";
import * as contentProseDl from "@zudo-sg/ui/src/content/prose-dl/prose-dl.stories.tsx";
import * as contentProseEm from "@zudo-sg/ui/src/content/prose-em/prose-em.stories.tsx";
import * as contentProseH2 from "@zudo-sg/ui/src/content/prose-h2/prose-h2.stories.tsx";
import * as contentProseH3 from "@zudo-sg/ui/src/content/prose-h3/prose-h3.stories.tsx";
import * as contentProseH4 from "@zudo-sg/ui/src/content/prose-h4/prose-h4.stories.tsx";
import * as contentProseH5 from "@zudo-sg/ui/src/content/prose-h5/prose-h5.stories.tsx";
import * as contentProseH6 from "@zudo-sg/ui/src/content/prose-h6/prose-h6.stories.tsx";
import * as contentProseLi from "@zudo-sg/ui/src/content/prose-li/prose-li.stories.tsx";
import * as contentProseOl from "@zudo-sg/ui/src/content/prose-ol/prose-ol.stories.tsx";
import * as contentProseP from "@zudo-sg/ui/src/content/prose-p/prose-p.stories.tsx";
import * as contentProseStrong from "@zudo-sg/ui/src/content/prose-strong/prose-strong.stories.tsx";
import * as contentProseTable from "@zudo-sg/ui/src/content/prose-table/prose-table.stories.tsx";
import * as contentProseUl from "@zudo-sg/ui/src/content/prose-ul/prose-ul.stories.tsx";
import * as contentTypography from "@zudo-sg/ui/src/content/typography/typography.stories.tsx";
import * as formsContactForm from "@zudo-sg/ui/src/forms/contact-form/contact-form.stories.tsx";
import * as formsField from "@zudo-sg/ui/src/forms/field/field.stories.tsx";
import * as formsInput from "@zudo-sg/ui/src/forms/input/input.stories.tsx";
import * as formsRecruitEntryForm from "@zudo-sg/ui/src/forms/recruit-entry-form/recruit-entry-form.stories.tsx";
import * as formsReviewRow from "@zudo-sg/ui/src/forms/review-row/review-row.stories.tsx";
import * as formsSecondaryButton from "@zudo-sg/ui/src/forms/secondary-button/secondary-button.stories.tsx";
import * as formsSelect from "@zudo-sg/ui/src/forms/select/select.stories.tsx";
import * as formsSubmitButton from "@zudo-sg/ui/src/forms/submit-button/submit-button.stories.tsx";
import * as formsTextarea from "@zudo-sg/ui/src/forms/textarea/textarea.stories.tsx";
import * as landingBusinessLinePortal from "@zudo-sg/ui/src/landing/business-line-portal/business-line-portal.stories.tsx";
import * as landingBusinessSegments from "@zudo-sg/ui/src/landing/business-segments/business-segments.stories.tsx";
import * as landingCertList from "@zudo-sg/ui/src/landing/cert-list/cert-list.stories.tsx";
import * as landingCompanyProfileTable from "@zudo-sg/ui/src/landing/company-profile-table/company-profile-table.stories.tsx";
import * as landingDiscoveryTeaser from "@zudo-sg/ui/src/landing/discovery-teaser/discovery-teaser.stories.tsx";
import * as landingFeatureSplit from "@zudo-sg/ui/src/landing/feature-split/feature-split.stories.tsx";
import * as landingFinancialHighlights from "@zudo-sg/ui/src/landing/financial-highlights/financial-highlights.stories.tsx";
import * as landingGroupCompanyGrid from "@zudo-sg/ui/src/landing/group-company-grid/group-company-grid.stories.tsx";
import * as landingHistoryTimeline from "@zudo-sg/ui/src/landing/history-timeline/history-timeline.stories.tsx";
import * as landingInitiativeGrid from "@zudo-sg/ui/src/landing/initiative-grid/initiative-grid.stories.tsx";
import * as landingLandingHero from "@zudo-sg/ui/src/landing/landing-hero/landing-hero.stories.tsx";
import * as landingLineHero from "@zudo-sg/ui/src/landing/line-hero/line-hero.stories.tsx";
import * as landingLocationList from "@zudo-sg/ui/src/landing/location-list/location-list.stories.tsx";
import * as landingProductCategoryGrid from "@zudo-sg/ui/src/landing/product-category-grid/product-category-grid.stories.tsx";
import * as landingRecruitBand from "@zudo-sg/ui/src/landing/recruit-band/recruit-band.stories.tsx";
import * as landingSdgsHighlight from "@zudo-sg/ui/src/landing/sdgs-highlight/sdgs-highlight.stories.tsx";
import * as landingSectionNav from "@zudo-sg/ui/src/landing/section-nav/section-nav.stories.tsx";
import * as landingStatBand from "@zudo-sg/ui/src/landing/stat-band/stat-band.stories.tsx";
import * as landingStrengthList from "@zudo-sg/ui/src/landing/strength-list/strength-list.stories.tsx";
import * as landingValuePillars from "@zudo-sg/ui/src/landing/value-pillars/value-pillars.stories.tsx";
import * as mediaPlaceholderBox from "@zudo-sg/ui/src/media/placeholder-box/placeholder-box.stories.tsx";
import * as newsCategoryBadge from "@zudo-sg/ui/src/news/category-badge/category-badge.stories.tsx";
import * as newsNewsFilter from "@zudo-sg/ui/src/news/news-filter/news-filter.stories.tsx";
import * as newsNewsList from "@zudo-sg/ui/src/news/news-list/news-list.stories.tsx";
import * as newsNewsTeaser from "@zudo-sg/ui/src/news/news-teaser/news-teaser.stories.tsx";
import * as searchSearchResultsEnhancer from "@zudo-sg/ui/src/search/search-results-enhancer/search-results-enhancer.stories.tsx";
import * as searchSearchResults from "@zudo-sg/ui/src/search/search-results/search-results.stories.tsx";
import * as sharedAutoGrid from "@zudo-sg/ui/src/shared/auto-grid/auto-grid.stories.tsx";
import * as sharedCardLink from "@zudo-sg/ui/src/shared/card-link/card-link.stories.tsx";
import * as sharedContainer from "@zudo-sg/ui/src/shared/container/container.stories.tsx";
import * as sharedCtaButton from "@zudo-sg/ui/src/shared/cta-button/cta-button.stories.tsx";
import * as sharedHero from "@zudo-sg/ui/src/shared/hero/hero.stories.tsx";
import * as sharedSectionHeading from "@zudo-sg/ui/src/shared/section-heading/section-heading.stories.tsx";
import * as sharedSplitLayout from "@zudo-sg/ui/src/shared/split-layout/split-layout.stories.tsx";
import * as sharedStack from "@zudo-sg/ui/src/shared/stack/stack.stories.tsx";

/**
 * Path → story module map. Keys are glob-relative (e.g.
 * `./ui/src/button/button.stories.tsx`). Each module is
 * `{ default: meta, ...named Story exports }`.
 */
export const storyModules: Record<string, StoryModule> = {
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
  "./ui/src/content/prose-a/prose-a.stories.tsx": contentProseA as unknown as StoryModule,
  "./ui/src/content/prose-blockquote/prose-blockquote.stories.tsx": contentProseBlockquote as unknown as StoryModule,
  "./ui/src/content/prose-dl/prose-dl.stories.tsx": contentProseDl as unknown as StoryModule,
  "./ui/src/content/prose-em/prose-em.stories.tsx": contentProseEm as unknown as StoryModule,
  "./ui/src/content/prose-h2/prose-h2.stories.tsx": contentProseH2 as unknown as StoryModule,
  "./ui/src/content/prose-h3/prose-h3.stories.tsx": contentProseH3 as unknown as StoryModule,
  "./ui/src/content/prose-h4/prose-h4.stories.tsx": contentProseH4 as unknown as StoryModule,
  "./ui/src/content/prose-h5/prose-h5.stories.tsx": contentProseH5 as unknown as StoryModule,
  "./ui/src/content/prose-h6/prose-h6.stories.tsx": contentProseH6 as unknown as StoryModule,
  "./ui/src/content/prose-li/prose-li.stories.tsx": contentProseLi as unknown as StoryModule,
  "./ui/src/content/prose-ol/prose-ol.stories.tsx": contentProseOl as unknown as StoryModule,
  "./ui/src/content/prose-p/prose-p.stories.tsx": contentProseP as unknown as StoryModule,
  "./ui/src/content/prose-strong/prose-strong.stories.tsx": contentProseStrong as unknown as StoryModule,
  "./ui/src/content/prose-table/prose-table.stories.tsx": contentProseTable as unknown as StoryModule,
  "./ui/src/content/prose-ul/prose-ul.stories.tsx": contentProseUl as unknown as StoryModule,
  "./ui/src/content/typography/typography.stories.tsx": contentTypography as unknown as StoryModule,
  "./ui/src/forms/contact-form/contact-form.stories.tsx": formsContactForm as unknown as StoryModule,
  "./ui/src/forms/field/field.stories.tsx": formsField as unknown as StoryModule,
  "./ui/src/forms/input/input.stories.tsx": formsInput as unknown as StoryModule,
  "./ui/src/forms/recruit-entry-form/recruit-entry-form.stories.tsx": formsRecruitEntryForm as unknown as StoryModule,
  "./ui/src/forms/review-row/review-row.stories.tsx": formsReviewRow as unknown as StoryModule,
  "./ui/src/forms/secondary-button/secondary-button.stories.tsx": formsSecondaryButton as unknown as StoryModule,
  "./ui/src/forms/select/select.stories.tsx": formsSelect as unknown as StoryModule,
  "./ui/src/forms/submit-button/submit-button.stories.tsx": formsSubmitButton as unknown as StoryModule,
  "./ui/src/forms/textarea/textarea.stories.tsx": formsTextarea as unknown as StoryModule,
  "./ui/src/landing/business-line-portal/business-line-portal.stories.tsx": landingBusinessLinePortal as unknown as StoryModule,
  "./ui/src/landing/business-segments/business-segments.stories.tsx": landingBusinessSegments as unknown as StoryModule,
  "./ui/src/landing/cert-list/cert-list.stories.tsx": landingCertList as unknown as StoryModule,
  "./ui/src/landing/company-profile-table/company-profile-table.stories.tsx": landingCompanyProfileTable as unknown as StoryModule,
  "./ui/src/landing/discovery-teaser/discovery-teaser.stories.tsx": landingDiscoveryTeaser as unknown as StoryModule,
  "./ui/src/landing/feature-split/feature-split.stories.tsx": landingFeatureSplit as unknown as StoryModule,
  "./ui/src/landing/financial-highlights/financial-highlights.stories.tsx": landingFinancialHighlights as unknown as StoryModule,
  "./ui/src/landing/group-company-grid/group-company-grid.stories.tsx": landingGroupCompanyGrid as unknown as StoryModule,
  "./ui/src/landing/history-timeline/history-timeline.stories.tsx": landingHistoryTimeline as unknown as StoryModule,
  "./ui/src/landing/initiative-grid/initiative-grid.stories.tsx": landingInitiativeGrid as unknown as StoryModule,
  "./ui/src/landing/landing-hero/landing-hero.stories.tsx": landingLandingHero as unknown as StoryModule,
  "./ui/src/landing/line-hero/line-hero.stories.tsx": landingLineHero as unknown as StoryModule,
  "./ui/src/landing/location-list/location-list.stories.tsx": landingLocationList as unknown as StoryModule,
  "./ui/src/landing/product-category-grid/product-category-grid.stories.tsx": landingProductCategoryGrid as unknown as StoryModule,
  "./ui/src/landing/recruit-band/recruit-band.stories.tsx": landingRecruitBand as unknown as StoryModule,
  "./ui/src/landing/sdgs-highlight/sdgs-highlight.stories.tsx": landingSdgsHighlight as unknown as StoryModule,
  "./ui/src/landing/section-nav/section-nav.stories.tsx": landingSectionNav as unknown as StoryModule,
  "./ui/src/landing/stat-band/stat-band.stories.tsx": landingStatBand as unknown as StoryModule,
  "./ui/src/landing/strength-list/strength-list.stories.tsx": landingStrengthList as unknown as StoryModule,
  "./ui/src/landing/value-pillars/value-pillars.stories.tsx": landingValuePillars as unknown as StoryModule,
  "./ui/src/media/placeholder-box/placeholder-box.stories.tsx": mediaPlaceholderBox as unknown as StoryModule,
  "./ui/src/news/category-badge/category-badge.stories.tsx": newsCategoryBadge as unknown as StoryModule,
  "./ui/src/news/news-filter/news-filter.stories.tsx": newsNewsFilter as unknown as StoryModule,
  "./ui/src/news/news-list/news-list.stories.tsx": newsNewsList as unknown as StoryModule,
  "./ui/src/news/news-teaser/news-teaser.stories.tsx": newsNewsTeaser as unknown as StoryModule,
  "./ui/src/search/search-results-enhancer/search-results-enhancer.stories.tsx": searchSearchResultsEnhancer as unknown as StoryModule,
  "./ui/src/search/search-results/search-results.stories.tsx": searchSearchResults as unknown as StoryModule,
  "./ui/src/shared/auto-grid/auto-grid.stories.tsx": sharedAutoGrid as unknown as StoryModule,
  "./ui/src/shared/card-link/card-link.stories.tsx": sharedCardLink as unknown as StoryModule,
  "./ui/src/shared/container/container.stories.tsx": sharedContainer as unknown as StoryModule,
  "./ui/src/shared/cta-button/cta-button.stories.tsx": sharedCtaButton as unknown as StoryModule,
  "./ui/src/shared/hero/hero.stories.tsx": sharedHero as unknown as StoryModule,
  "./ui/src/shared/section-heading/section-heading.stories.tsx": sharedSectionHeading as unknown as StoryModule,
  "./ui/src/shared/split-layout/split-layout.stories.tsx": sharedSplitLayout as unknown as StoryModule,
  "./ui/src/shared/stack/stack.stories.tsx": sharedStack as unknown as StoryModule,
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
  "./ui/src/content/prose-a/prose-a.stories.tsx": ["Default", "HashLink"],
  "./ui/src/content/prose-blockquote/prose-blockquote.stories.tsx": ["Default"],
  "./ui/src/content/prose-dl/prose-dl.stories.tsx": ["Default"],
  "./ui/src/content/prose-em/prose-em.stories.tsx": ["Default"],
  "./ui/src/content/prose-h2/prose-h2.stories.tsx": ["Default"],
  "./ui/src/content/prose-h3/prose-h3.stories.tsx": ["Default"],
  "./ui/src/content/prose-h4/prose-h4.stories.tsx": ["Default"],
  "./ui/src/content/prose-h5/prose-h5.stories.tsx": ["Default"],
  "./ui/src/content/prose-h6/prose-h6.stories.tsx": ["Default"],
  "./ui/src/content/prose-li/prose-li.stories.tsx": ["Default"],
  "./ui/src/content/prose-ol/prose-ol.stories.tsx": ["Default"],
  "./ui/src/content/prose-p/prose-p.stories.tsx": ["Default"],
  "./ui/src/content/prose-strong/prose-strong.stories.tsx": ["Default"],
  "./ui/src/content/prose-table/prose-table.stories.tsx": ["Default"],
  "./ui/src/content/prose-ul/prose-ul.stories.tsx": ["Default"],
  "./ui/src/content/typography/typography.stories.tsx": ["AllElements", "Headings", "TextFormatting", "Lists", "Table", "QuoteAndDefinitionList"],
  "./ui/src/forms/contact-form/contact-form.stories.tsx": ["Default"],
  "./ui/src/forms/field/field.stories.tsx": ["Required", "Optional"],
  "./ui/src/forms/input/input.stories.tsx": ["Playground"],
  "./ui/src/forms/recruit-entry-form/recruit-entry-form.stories.tsx": ["NewGraduate", "Career"],
  "./ui/src/forms/review-row/review-row.stories.tsx": ["Default"],
  "./ui/src/forms/secondary-button/secondary-button.stories.tsx": ["Default"],
  "./ui/src/forms/select/select.stories.tsx": ["Default"],
  "./ui/src/forms/submit-button/submit-button.stories.tsx": ["Default", "Disabled"],
  "./ui/src/forms/textarea/textarea.stories.tsx": ["Default"],
  "./ui/src/landing/business-line-portal/business-line-portal.stories.tsx": ["Default", "Filtered", "Bare"],
  "./ui/src/landing/business-segments/business-segments.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/cert-list/cert-list.stories.tsx": ["Default", "Single", "Narrow"],
  "./ui/src/landing/company-profile-table/company-profile-table.stories.tsx": ["Default", "CustomRows", "Narrow"],
  "./ui/src/landing/discovery-teaser/discovery-teaser.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/feature-split/feature-split.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/financial-highlights/financial-highlights.stories.tsx": ["Default", "WithValues", "Narrow"],
  "./ui/src/landing/group-company-grid/group-company-grid.stories.tsx": ["Default", "ManyCards", "Bare"],
  "./ui/src/landing/history-timeline/history-timeline.stories.tsx": ["Default", "RecentOnly"],
  "./ui/src/landing/initiative-grid/initiative-grid.stories.tsx": ["Default", "Sdgs", "Narrow"],
  "./ui/src/landing/landing-hero/landing-hero.stories.tsx": ["Default", "SingleAction"],
  "./ui/src/landing/line-hero/line-hero.stories.tsx": ["Default", "Minimal"],
  "./ui/src/landing/location-list/location-list.stories.tsx": ["Default", "SingleGroup"],
  "./ui/src/landing/product-category-grid/product-category-grid.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/recruit-band/recruit-band.stories.tsx": ["Default", "CustomCopy"],
  "./ui/src/landing/sdgs-highlight/sdgs-highlight.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/section-nav/section-nav.stories.tsx": ["Default", "WithExternalLink"],
  "./ui/src/landing/stat-band/stat-band.stories.tsx": ["Default", "CustomStats", "Narrow"],
  "./ui/src/landing/strength-list/strength-list.stories.tsx": ["Default", "Narrow"],
  "./ui/src/landing/value-pillars/value-pillars.stories.tsx": ["Default", "Narrow"],
  "./ui/src/media/placeholder-box/placeholder-box.stories.tsx": ["Default", "AspectRatios", "Sizes", "FromMarkdownImg"],
  "./ui/src/news/category-badge/category-badge.stories.tsx": ["AllCategories", "UnknownFallback"],
  "./ui/src/news/news-filter/news-filter.stories.tsx": ["Default", "FewCategories"],
  "./ui/src/news/news-list/news-list.stories.tsx": ["Default", "LimitedThree", "IROnly", "WithFilter", "Empty"],
  "./ui/src/news/news-teaser/news-teaser.stories.tsx": ["News", "IRNews", "WithIntro", "Narrow"],
  "./ui/src/search/search-results-enhancer/search-results-enhancer.stories.tsx": ["Live"],
  "./ui/src/search/search-results/search-results.stories.tsx": ["Default", "WithQuery", "NoResults"],
  "./ui/src/shared/auto-grid/auto-grid.stories.tsx": ["Default", "WiderTracks", "Fill"],
  "./ui/src/shared/card-link/card-link.stories.tsx": ["Default", "ViewAll"],
  "./ui/src/shared/container/container.stories.tsx": ["Default"],
  "./ui/src/shared/cta-button/cta-button.stories.tsx": ["Playground", "Pair"],
  "./ui/src/shared/hero/hero.stories.tsx": ["Primary", "Secondary"],
  "./ui/src/shared/section-heading/section-heading.stories.tsx": ["Default", "HeadingOnly", "WithEyebrow"],
  "./ui/src/shared/split-layout/split-layout.stories.tsx": ["Default", "OrderedRightChildren", "Narrow"],
  "./ui/src/shared/stack/stack.stories.tsx": ["Default", "Horizontal", "Narrow"],
};
// GENERATED:SG_REGISTRY_END
