// @zudo-sg/ui — shared Preact component library.
//
// Public barrel. Components are consumed FROM SOURCE (this package's "main" /
// "exports" point at src/*.ts directly) — there is no build step; the consuming
// app's Vite/zfb pipeline transpiles these .tsx files. See STORIES.md.
//
// Stories are NOT re-exported here: the catalog discovers `*.stories.tsx` via
// generated explicit imports (see STORIES.md), so keeping them out of the
// barrel avoids pulling story render trees into app bundles.
//
// Sections below are grouped by StoryCategory (packages/ui/src/stories/types.ts),
// NOT by the on-disk category-nested directory (shared/cards/media/chrome/
// content/news/forms/search/landing) — a directory can span multiple
// categories (e.g. shared/ has Actions, Layout, Navigation, and Content
// components). scripts/lib/component-scaffold.mjs's `insertBarrelExport`
// locates a component's section by matching its StoryCategory against a
// "// ── <Category> ──" header, so every StoryCategory needs exactly one
// section here (add one by hand if a new category is introduced).
//
// Internal implementation helpers (the `*/lib/*` modules under forms/ and
// search/, plus search's data-contract + renderer files) are deliberately NOT
// re-exported — they're consumed by their owning enhancer islands via direct
// subpath imports, not part of the component-level public API.

// ── Actions ──────────────────────────────────────────────────────────────
export { CtaButton } from "./shared/cta-button/cta-button";
export type { CtaButtonVariant, CtaButtonProps } from "./shared/cta-button/cta-button";

// ── Typography ───────────────────────────────────────────────────────────
export { ProseA } from "./content/prose-a/prose-a";
export type { ProseAProps } from "./content/prose-a/prose-a";

export { ProseBlockquote } from "./content/prose-blockquote/prose-blockquote";
export type { ProseBlockquoteProps } from "./content/prose-blockquote/prose-blockquote";

export { ProseDl, ProseDt, ProseDd } from "./content/prose-dl/prose-dl";
export type { ProseDlProps, ProseDtProps, ProseDdProps } from "./content/prose-dl/prose-dl";

export { ProseEm } from "./content/prose-em/prose-em";
export type { ProseEmProps } from "./content/prose-em/prose-em";

export { ProseH2 } from "./content/prose-h2/prose-h2";
export type { ProseH2Props } from "./content/prose-h2/prose-h2";

export { ProseH3 } from "./content/prose-h3/prose-h3";
export type { ProseH3Props } from "./content/prose-h3/prose-h3";

export { ProseH4 } from "./content/prose-h4/prose-h4";
export type { ProseH4Props } from "./content/prose-h4/prose-h4";

export { ProseH5 } from "./content/prose-h5/prose-h5";
export type { ProseH5Props } from "./content/prose-h5/prose-h5";

export { ProseH6 } from "./content/prose-h6/prose-h6";
export type { ProseH6Props } from "./content/prose-h6/prose-h6";

export { ProseLi } from "./content/prose-li/prose-li";
export type { ProseLiProps } from "./content/prose-li/prose-li";

export { ProseOl } from "./content/prose-ol/prose-ol";
export type { ProseOlProps } from "./content/prose-ol/prose-ol";

export { ProseP } from "./content/prose-p/prose-p";
export type { ProsePProps } from "./content/prose-p/prose-p";

export { ProseStrong } from "./content/prose-strong/prose-strong";
export type { ProseStrongProps } from "./content/prose-strong/prose-strong";

export { ProseTable, ProseTh, ProseTd } from "./content/prose-table/prose-table";
export type { ProseTableProps, ProseThProps, ProseTdProps } from "./content/prose-table/prose-table";

export { ProseUl } from "./content/prose-ul/prose-ul";
export type { ProseUlProps } from "./content/prose-ul/prose-ul";

// ── Layout ───────────────────────────────────────────────────────────────
export { AutoGrid } from "./shared/auto-grid/auto-grid";
export type { AutoGridMin, AutoGridGap, AutoGridProps } from "./shared/auto-grid/auto-grid";

export { Container } from "./shared/container/container";
export type { ContainerProps } from "./shared/container/container";

export { SplitLayout } from "./shared/split-layout/split-layout";
export type {
  SplitLayoutRatio,
  SplitLayoutGap,
  SplitLayoutProps,
} from "./shared/split-layout/split-layout";

export { Stack } from "./shared/stack/stack";
export type {
  StackDirection,
  StackGap,
  StackAlign,
  StackJustify,
  StackProps,
} from "./shared/stack/stack";

// ── Data display ─────────────────────────────────────────────────────────
export { Card, CardTitle } from "./cards/card/card";
export type { CardVariant, CardPadding, CardProps, CardTitleProps } from "./cards/card/card";

export { CardGrid } from "./cards/card-grid/card-grid";
export type { CardGridProps } from "./cards/card-grid/card-grid";

export { CompanyProfileTable } from "./landing/company-profile-table/company-profile-table";
export type {
  CompanyProfileRow,
  CompanyProfileTableProps,
} from "./landing/company-profile-table/company-profile-table";

export { FinancialHighlights } from "./landing/financial-highlights/financial-highlights";
export type {
  FinancialMetric,
  FinancialHighlightsProps,
} from "./landing/financial-highlights/financial-highlights";

export { LocationList } from "./landing/location-list/location-list";
export type { Location, LocationGroup, LocationListProps } from "./landing/location-list/location-list";

// ── Forms ────────────────────────────────────────────────────────────────
export { default as ContactFormEnhancer } from "./forms/contact-form/contact-form-enhancer";
export type { ContactFormEnhancerProps } from "./forms/contact-form/contact-form-enhancer";
export { ContactForm } from "./forms/contact-form/contact-form";
export type { ContactFormProps } from "./forms/contact-form/contact-form";

export { Field } from "./forms/field/field";
export type { FieldProps } from "./forms/field/field";

export { Input } from "./forms/input/input";
export type { InputProps } from "./forms/input/input";

export { RecruitEntryForm } from "./forms/recruit-entry-form/recruit-entry-form";
export type { RecruitEntryFormProps } from "./forms/recruit-entry-form/recruit-entry-form";
export { default as RecruitFormEnhancer } from "./forms/recruit-entry-form/recruit-form-enhancer";

export { ReviewRow } from "./forms/review-row/review-row";
export type { ReviewRowProps } from "./forms/review-row/review-row";

export { SecondaryButton } from "./forms/secondary-button/secondary-button";
export type { SecondaryButtonProps } from "./forms/secondary-button/secondary-button";

export { Select } from "./forms/select/select";
export type { SelectOption, SelectProps } from "./forms/select/select";

export { SubmitButton } from "./forms/submit-button/submit-button";
export type { SubmitButtonProps } from "./forms/submit-button/submit-button";

export { Textarea } from "./forms/textarea/textarea";
export type { TextareaProps } from "./forms/textarea/textarea";

// ── Navigation ───────────────────────────────────────────────────────────
export { Breadcrumbs } from "./chrome/breadcrumbs/breadcrumbs";
export type { Crumb, BreadcrumbsProps } from "./chrome/breadcrumbs/breadcrumbs";

export { CardLink, ViewAllLink } from "./shared/card-link/card-link";
export type { CardLinkProps, ViewAllLinkProps } from "./shared/card-link/card-link";

export { default as ContextSwitcherEnhancer } from "./chrome/context-switcher-enhancer/context-switcher-enhancer";
export { default as MobileNavEnhancer } from "./chrome/mobile-nav-enhancer/mobile-nav-enhancer";
export { default as NavEnhancer } from "./chrome/nav-enhancer/nav-enhancer";
export { default as SearchToggleEnhancer } from "./chrome/search-toggle-enhancer/search-toggle-enhancer";

export { SiteFooter } from "./chrome/site-footer/site-footer";
export type { FooterLink, SiteFooterProps } from "./chrome/site-footer/site-footer";

export { SiteHeader } from "./chrome/site-header/site-header";
export type { BrandSwitcherItem, SiteHeaderProps } from "./chrome/site-header/site-header";

export { SiteNav } from "./chrome/site-nav/site-nav";
export type { NavLeaf, NavSection, SiteNavProps } from "./chrome/site-nav/site-nav";

// ── Content ──────────────────────────────────────────────────────────────
export { CertList } from "./landing/cert-list/cert-list";
export type { Cert, CertListProps } from "./landing/cert-list/cert-list";

export { GroupCompanyGrid } from "./landing/group-company-grid/group-company-grid";
export type { GroupCompany, GroupCompanyGridProps } from "./landing/group-company-grid/group-company-grid";

export { Hero } from "./shared/hero/hero";
export type { HeroAction, HeroVariant, HeroProps } from "./shared/hero/hero";

export { HistoryTimeline } from "./landing/history-timeline/history-timeline";
export type { HistoryEntry, HistoryTimelineProps } from "./landing/history-timeline/history-timeline";

export { InitiativeGrid } from "./landing/initiative-grid/initiative-grid";
export type { Initiative, InitiativeGridProps } from "./landing/initiative-grid/initiative-grid";

export { ProductCategoryGrid } from "./landing/product-category-grid/product-category-grid";
export type {
  ProductCategory,
  ProductCategoryGridProps,
} from "./landing/product-category-grid/product-category-grid";

export { SectionHeading } from "./shared/section-heading/section-heading";
export type { SectionHeadingProps } from "./shared/section-heading/section-heading";

export { StrengthList } from "./landing/strength-list/strength-list";
export type { Strength, StrengthListProps } from "./landing/strength-list/strength-list";

export { ValuePillars } from "./landing/value-pillars/value-pillars";
export type { ValuePillar, ValuePillarsProps } from "./landing/value-pillars/value-pillars";

// ── Landing ──────────────────────────────────────────────────────────────
export { BusinessLinePortal } from "./landing/business-line-portal/business-line-portal";
export type {
  BusinessLinePortalLine,
  BusinessLinePortalProps,
} from "./landing/business-line-portal/business-line-portal";

export { BusinessSegments } from "./landing/business-segments/business-segments";
export type { BusinessSegment, BusinessSegmentsProps } from "./landing/business-segments/business-segments";

export { DiscoveryTeaser } from "./landing/discovery-teaser/discovery-teaser";
export type { DiscoveryScene, DiscoveryTeaserProps } from "./landing/discovery-teaser/discovery-teaser";

export { FeatureSplit } from "./landing/feature-split/feature-split";
export type { FeatureSplitPillar, FeatureSplitProps } from "./landing/feature-split/feature-split";

export { LandingHero } from "./landing/landing-hero/landing-hero";
export type { LandingHeroProps } from "./landing/landing-hero/landing-hero";

export { LineHero } from "./landing/line-hero/line-hero";
export type { LineHeroProps } from "./landing/line-hero/line-hero";

export { RecruitBand } from "./landing/recruit-band/recruit-band";
export type { RecruitBandProps } from "./landing/recruit-band/recruit-band";

export { SdgsHighlight } from "./landing/sdgs-highlight/sdgs-highlight";
export type { SdgsInitiative, SdgsHighlightProps } from "./landing/sdgs-highlight/sdgs-highlight";

export { SectionNav } from "./landing/section-nav/section-nav";
export type { SectionNavLink, SectionNavProps } from "./landing/section-nav/section-nav";

export { StatBand } from "./landing/stat-band/stat-band";
export type { BandStat, StatBandProps } from "./landing/stat-band/stat-band";

// ── News ─────────────────────────────────────────────────────────────────
export { CategoryBadge } from "./news/category-badge/category-badge";
export type { CategoryBadgeProps } from "./news/category-badge/category-badge";

export { default as NewsFilterEnhancer } from "./news/news-filter/news-filter-enhancer";
export { NewsFilter } from "./news/news-filter/news-filter";
export type { NewsFilterProps } from "./news/news-filter/news-filter";

export { NewsList } from "./news/news-list/news-list";
export type { NewsItem, NewsListProps } from "./news/news-list/news-list";

export { NewsTeaser } from "./news/news-teaser/news-teaser";
export type { NewsTeaserProps } from "./news/news-teaser/news-teaser";

// ── Search ───────────────────────────────────────────────────────────────
export { SearchResults } from "./search/search-results/search-results";
export type { SearchResultsProps } from "./search/search-results/search-results";

export { default as SearchResultsEnhancer } from "./search/search-results-enhancer/search-results-enhancer";

// ── Feedback ─────────────────────────────────────────────────────────────
export { Callout, Note } from "./cards/callout/callout";
export type { CalloutTone, CalloutProps } from "./cards/callout/callout";

// ── Media ────────────────────────────────────────────────────────────────
export { PlaceholderBox } from "./media/placeholder-box/placeholder-box";
export type { PlaceholderBoxSize, PlaceholderBoxProps } from "./media/placeholder-box/placeholder-box";

// ── Story-authoring contract (consumed by the S6 catalog) ────────────────
export type {
  StoryMeta,
  StoryCategory,
  Story,
  StoryControl,
  StoryModule,
} from "./stories/types";
export { defineStory } from "./stories/types";

// ── Composer authoring contract (consumed by the /composer app, epic #243) ─
export type {
  JsonPrimitive,
  JsonValue,
  ComposerSource,
  ComposerField,
  ComposerFieldMeta,
  ComposerSlot,
  ComposerSlotMeta,
  ComposerSlotCardinality,
  ComposerConstraints,
  ComposerInlineEditorAdapter,
  ComposerAdapters,
  ComposerAdaptersMeta,
  ComposerDefaults,
  ComposerDefinition,
  ComposerMeta,
} from "./composer/types";
export { defineComposer } from "./composer/types";

// ── Utilities ────────────────────────────────────────────────────────────
export { cx } from "./lib/cx";
export type { ClassValue } from "./lib/cx";

export { externalLinkAttrs, EXTERNAL_GLYPH, INTERNAL_GLYPH } from "./shared/external-link/external-link";
export type { ExternalLinkAttrs } from "./shared/external-link/external-link";
