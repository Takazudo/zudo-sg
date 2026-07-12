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
import * as contentProseA from "../../content/prose-a/prose-a.stories";
import * as contentProseBlockquote from "../../content/prose-blockquote/prose-blockquote.stories";
import * as contentProseDl from "../../content/prose-dl/prose-dl.stories";
import * as contentProseEm from "../../content/prose-em/prose-em.stories";
import * as contentProseH2 from "../../content/prose-h2/prose-h2.stories";
import * as contentProseH3 from "../../content/prose-h3/prose-h3.stories";
import * as contentProseH4 from "../../content/prose-h4/prose-h4.stories";
import * as contentProseH5 from "../../content/prose-h5/prose-h5.stories";
import * as contentProseH6 from "../../content/prose-h6/prose-h6.stories";
import * as contentProseLi from "../../content/prose-li/prose-li.stories";
import * as contentProseOl from "../../content/prose-ol/prose-ol.stories";
import * as contentProseP from "../../content/prose-p/prose-p.stories";
import * as contentProseStrong from "../../content/prose-strong/prose-strong.stories";
import * as contentProseTable from "../../content/prose-table/prose-table.stories";
import * as contentProseUl from "../../content/prose-ul/prose-ul.stories";
import * as contentTypography from "../../content/typography/typography.stories";
import * as formsContactForm from "../../forms/contact-form/contact-form.stories";
import * as formsField from "../../forms/field/field.stories";
import * as formsInput from "../../forms/input/input.stories";
import * as formsRecruitEntryForm from "../../forms/recruit-entry-form/recruit-entry-form.stories";
import * as formsReviewRow from "../../forms/review-row/review-row.stories";
import * as formsSecondaryButton from "../../forms/secondary-button/secondary-button.stories";
import * as formsSelect from "../../forms/select/select.stories";
import * as formsSubmitButton from "../../forms/submit-button/submit-button.stories";
import * as formsTextarea from "../../forms/textarea/textarea.stories";
import * as landingBusinessLinePortal from "../../landing/business-line-portal/business-line-portal.stories";
import * as landingBusinessSegments from "../../landing/business-segments/business-segments.stories";
import * as landingCertList from "../../landing/cert-list/cert-list.stories";
import * as landingCompanyProfileTable from "../../landing/company-profile-table/company-profile-table.stories";
import * as landingDiscoveryTeaser from "../../landing/discovery-teaser/discovery-teaser.stories";
import * as landingFeatureSplit from "../../landing/feature-split/feature-split.stories";
import * as landingFinancialHighlights from "../../landing/financial-highlights/financial-highlights.stories";
import * as landingGroupCompanyGrid from "../../landing/group-company-grid/group-company-grid.stories";
import * as landingHistoryTimeline from "../../landing/history-timeline/history-timeline.stories";
import * as landingInitiativeGrid from "../../landing/initiative-grid/initiative-grid.stories";
import * as landingLandingHero from "../../landing/landing-hero/landing-hero.stories";
import * as landingLineHero from "../../landing/line-hero/line-hero.stories";
import * as landingLocationList from "../../landing/location-list/location-list.stories";
import * as landingProductCategoryGrid from "../../landing/product-category-grid/product-category-grid.stories";
import * as landingRecruitBand from "../../landing/recruit-band/recruit-band.stories";
import * as landingSdgsHighlight from "../../landing/sdgs-highlight/sdgs-highlight.stories";
import * as landingSectionNav from "../../landing/section-nav/section-nav.stories";
import * as landingStatBand from "../../landing/stat-band/stat-band.stories";
import * as landingStrengthList from "../../landing/strength-list/strength-list.stories";
import * as landingValuePillars from "../../landing/value-pillars/value-pillars.stories";
import * as mediaPlaceholderBox from "../../media/placeholder-box/placeholder-box.stories";
import * as newsCategoryBadge from "../../news/category-badge/category-badge.stories";
import * as newsNewsFilter from "../../news/news-filter/news-filter.stories";
import * as newsNewsList from "../../news/news-list/news-list.stories";
import * as newsNewsTeaser from "../../news/news-teaser/news-teaser.stories";
import * as searchSearchResultsEnhancer from "../../search/search-results-enhancer/search-results-enhancer.stories";
import * as searchSearchResults from "../../search/search-results/search-results.stories";
import * as sharedAutoGrid from "../../shared/auto-grid/auto-grid.stories";
import * as sharedCardLink from "../../shared/card-link/card-link.stories";
import * as sharedContainer from "../../shared/container/container.stories";
import * as sharedCtaButton from "../../shared/cta-button/cta-button.stories";
import * as sharedHero from "../../shared/hero/hero.stories";
import * as sharedSectionHeading from "../../shared/section-heading/section-heading.stories";

export const STORY_MODULES: Record<string, StoryModule> = {
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
  "content/prose-a/prose-a.stories.tsx": contentProseA as unknown as StoryModule,
  "content/prose-blockquote/prose-blockquote.stories.tsx": contentProseBlockquote as unknown as StoryModule,
  "content/prose-dl/prose-dl.stories.tsx": contentProseDl as unknown as StoryModule,
  "content/prose-em/prose-em.stories.tsx": contentProseEm as unknown as StoryModule,
  "content/prose-h2/prose-h2.stories.tsx": contentProseH2 as unknown as StoryModule,
  "content/prose-h3/prose-h3.stories.tsx": contentProseH3 as unknown as StoryModule,
  "content/prose-h4/prose-h4.stories.tsx": contentProseH4 as unknown as StoryModule,
  "content/prose-h5/prose-h5.stories.tsx": contentProseH5 as unknown as StoryModule,
  "content/prose-h6/prose-h6.stories.tsx": contentProseH6 as unknown as StoryModule,
  "content/prose-li/prose-li.stories.tsx": contentProseLi as unknown as StoryModule,
  "content/prose-ol/prose-ol.stories.tsx": contentProseOl as unknown as StoryModule,
  "content/prose-p/prose-p.stories.tsx": contentProseP as unknown as StoryModule,
  "content/prose-strong/prose-strong.stories.tsx": contentProseStrong as unknown as StoryModule,
  "content/prose-table/prose-table.stories.tsx": contentProseTable as unknown as StoryModule,
  "content/prose-ul/prose-ul.stories.tsx": contentProseUl as unknown as StoryModule,
  "content/typography/typography.stories.tsx": contentTypography as unknown as StoryModule,
  "forms/contact-form/contact-form.stories.tsx": formsContactForm as unknown as StoryModule,
  "forms/field/field.stories.tsx": formsField as unknown as StoryModule,
  "forms/input/input.stories.tsx": formsInput as unknown as StoryModule,
  "forms/recruit-entry-form/recruit-entry-form.stories.tsx": formsRecruitEntryForm as unknown as StoryModule,
  "forms/review-row/review-row.stories.tsx": formsReviewRow as unknown as StoryModule,
  "forms/secondary-button/secondary-button.stories.tsx": formsSecondaryButton as unknown as StoryModule,
  "forms/select/select.stories.tsx": formsSelect as unknown as StoryModule,
  "forms/submit-button/submit-button.stories.tsx": formsSubmitButton as unknown as StoryModule,
  "forms/textarea/textarea.stories.tsx": formsTextarea as unknown as StoryModule,
  "landing/business-line-portal/business-line-portal.stories.tsx": landingBusinessLinePortal as unknown as StoryModule,
  "landing/business-segments/business-segments.stories.tsx": landingBusinessSegments as unknown as StoryModule,
  "landing/cert-list/cert-list.stories.tsx": landingCertList as unknown as StoryModule,
  "landing/company-profile-table/company-profile-table.stories.tsx": landingCompanyProfileTable as unknown as StoryModule,
  "landing/discovery-teaser/discovery-teaser.stories.tsx": landingDiscoveryTeaser as unknown as StoryModule,
  "landing/feature-split/feature-split.stories.tsx": landingFeatureSplit as unknown as StoryModule,
  "landing/financial-highlights/financial-highlights.stories.tsx": landingFinancialHighlights as unknown as StoryModule,
  "landing/group-company-grid/group-company-grid.stories.tsx": landingGroupCompanyGrid as unknown as StoryModule,
  "landing/history-timeline/history-timeline.stories.tsx": landingHistoryTimeline as unknown as StoryModule,
  "landing/initiative-grid/initiative-grid.stories.tsx": landingInitiativeGrid as unknown as StoryModule,
  "landing/landing-hero/landing-hero.stories.tsx": landingLandingHero as unknown as StoryModule,
  "landing/line-hero/line-hero.stories.tsx": landingLineHero as unknown as StoryModule,
  "landing/location-list/location-list.stories.tsx": landingLocationList as unknown as StoryModule,
  "landing/product-category-grid/product-category-grid.stories.tsx": landingProductCategoryGrid as unknown as StoryModule,
  "landing/recruit-band/recruit-band.stories.tsx": landingRecruitBand as unknown as StoryModule,
  "landing/sdgs-highlight/sdgs-highlight.stories.tsx": landingSdgsHighlight as unknown as StoryModule,
  "landing/section-nav/section-nav.stories.tsx": landingSectionNav as unknown as StoryModule,
  "landing/stat-band/stat-band.stories.tsx": landingStatBand as unknown as StoryModule,
  "landing/strength-list/strength-list.stories.tsx": landingStrengthList as unknown as StoryModule,
  "landing/value-pillars/value-pillars.stories.tsx": landingValuePillars as unknown as StoryModule,
  "media/placeholder-box/placeholder-box.stories.tsx": mediaPlaceholderBox as unknown as StoryModule,
  "news/category-badge/category-badge.stories.tsx": newsCategoryBadge as unknown as StoryModule,
  "news/news-filter/news-filter.stories.tsx": newsNewsFilter as unknown as StoryModule,
  "news/news-list/news-list.stories.tsx": newsNewsList as unknown as StoryModule,
  "news/news-teaser/news-teaser.stories.tsx": newsNewsTeaser as unknown as StoryModule,
  "search/search-results-enhancer/search-results-enhancer.stories.tsx": searchSearchResultsEnhancer as unknown as StoryModule,
  "search/search-results/search-results.stories.tsx": searchSearchResults as unknown as StoryModule,
  "shared/auto-grid/auto-grid.stories.tsx": sharedAutoGrid as unknown as StoryModule,
  "shared/card-link/card-link.stories.tsx": sharedCardLink as unknown as StoryModule,
  "shared/container/container.stories.tsx": sharedContainer as unknown as StoryModule,
  "shared/cta-button/cta-button.stories.tsx": sharedCtaButton as unknown as StoryModule,
  "shared/hero/hero.stories.tsx": sharedHero as unknown as StoryModule,
  "shared/section-heading/section-heading.stories.tsx": sharedSectionHeading as unknown as StoryModule,
};
// GENERATED:SG_REGISTRY_END
