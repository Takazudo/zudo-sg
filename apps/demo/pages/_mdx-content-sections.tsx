/**
 * Bound MDX section components — thin wrappers pairing the generic,
 * prop-driven `@zudo-sg/ui` section components with this demo's own
 * fictional dummy dataset, registered under the same tag names the content
 * collection already uses (`<CompanyProfileTable />`, `<HistoryTimeline />`,
 * ..) — see `_mdx-components.ts`, which registers these (not the raw
 * `@zudo-sg/ui` components) into the MDX component map.
 *
 * `@zudo-sg/ui`'s ported section components take no default data (unlike
 * the reference implementation these are ported from, whose components
 * baked mock data in as prop defaults, since `@zudo-sg/ui` stays free of any
 * app-specific content) — every consuming app supplies its own. Each of
 * these tags is used in exactly one content page, so this file's per-tag
 * dataset is that page's single answer; content itself stays exactly what
 * the reference authored (bare `<Tag />` / `<Tag bare />` invocations, no
 * inline prop data).
 *
 * `NewsList` here is a live variant: it reads the `category`/`limit` props
 * the content collection already passes (`content/news/index.mdx`,
 * `content/ir/news.mdx`) and derives `items` from `lib/news.ts`'s
 * `getNews()` at render time — `@zudo-sg/ui`'s `NewsList` itself takes no
 * content-collection dependency, by design.
 */
import {
  CompanyProfileTable as CompanyProfileTableBase,
  type CompanyProfileRow,
} from "@zudo-sg/ui/src/landing/company-profile-table/company-profile-table.tsx";
import {
  HistoryTimeline as HistoryTimelineBase,
  type HistoryEntry,
} from "@zudo-sg/ui/src/landing/history-timeline/history-timeline.tsx";
import {
  LocationList as LocationListBase,
  type LocationGroup,
} from "@zudo-sg/ui/src/landing/location-list/location-list.tsx";
import { GroupCompanyGrid as GroupCompanyGridBase } from "@zudo-sg/ui/src/landing/group-company-grid/group-company-grid.tsx";
import type { GroupCompany } from "@zudo-sg/ui/src/landing/group-company-grid/group-company-grid.tsx";
import { ProductCategoryGrid as ProductCategoryGridBase } from "@zudo-sg/ui/src/landing/product-category-grid/product-category-grid.tsx";
import { StrengthList as StrengthListBase, type Strength } from "@zudo-sg/ui/src/landing/strength-list/strength-list.tsx";
import { BusinessLinePortal as BusinessLinePortalBase } from "@zudo-sg/ui/src/landing/business-line-portal/business-line-portal.tsx";
import { FinancialHighlights as FinancialHighlightsBase } from "@zudo-sg/ui/src/landing/financial-highlights/financial-highlights.tsx";
import type { FinancialMetric } from "@zudo-sg/ui/src/landing/financial-highlights/financial-highlights.tsx";
import { CertList as CertListBase, type Cert } from "@zudo-sg/ui/src/landing/cert-list/cert-list.tsx";
import { InitiativeGrid as InitiativeGridBase, type Initiative } from "@zudo-sg/ui/src/landing/initiative-grid/initiative-grid.tsx";
import { ValuePillars as ValuePillarsBase, type ValuePillar } from "@zudo-sg/ui/src/landing/value-pillars/value-pillars.tsx";
import { NewsList as NewsListBase } from "@zudo-sg/ui/src/news/news-list/news-list.tsx";

import { BUSINESS_SEGMENTS } from "../config/segments";
import { BUSINESS_LINE_LIST } from "../config/lines";
import { getNews } from "../lib/news";

/* ---------------------------------------------------------------------- */
/* CompanyProfileTable — content/company/profile.mdx                      */
/* ---------------------------------------------------------------------- */

const COMPANY_PROFILE_ROWS: CompanyProfileRow[] = [
  { label: "Company name", value: "Demo Company" },
  { label: "Founded", value: "Sample date" },
  { label: "Capital", value: "Sample amount" },
  { label: "Representative", value: "Sample executive" },
  { label: "Head office", value: "Sample City, Example Country" },
  { label: "Market", value: "Sample market" },
  { label: "Employees", value: "Sample workforce" },
  { label: "Revenue", value: "Sample revenue" },
  { label: "Business areas", value: "Electronic devices, components, equipment, and chemical products" },
  { label: "Banking partners", value: "Sample Bank and Example Bank" },
];

export function CompanyProfileTable({ class: cls }: { class?: string }) {
  return <CompanyProfileTableBase rows={COMPANY_PROFILE_ROWS} class={cls} />;
}

/* ---------------------------------------------------------------------- */
/* HistoryTimeline — content/company/history.mdx                          */
/* ---------------------------------------------------------------------- */

const HISTORY_ENTRIES: HistoryEntry[] = [
  { year: "1953", event: "The quick brown fox jumps over the lazy dog." },
  {
    year: "1958",
    event: "The quick brown fox jumps over the lazy dog.",
  },
  {
    year: "1961",
    event: "The quick brown fox jumps over the lazy dog.",
  },
  { year: "1963", event: "Reliable foundations" },
  {
    year: "1970",
    event:
      "The quick brown fox jumps over the lazy dog.",
  },
  { year: "1973", event: "Sample copy" },
  { year: "1974", event: "A practical example" },
  { year: "1977", event: "This is sample copy" },
  { year: "1980", event: "Working together" },
  { year: "1991", event: "Key point" },
  {
    year: "1995",
    event:
      "The quick brown fox jumps over the lazy dog.",
  },
  { year: "1999", event: "Sample body copy goes here" },
  {
    year: "2000",
    event: "The quick brown fox jumps over the lazy dog.",
  },
  {
    year: "2002",
    event: "The quick brown fox jumps over the lazy dog.",
  },
  { year: "2003", event: "Reliable foundations" },
  { year: "2016", event: "Sample copy" },
  { year: "2018", event: "A practical example" },
  { year: "2022", event: "This is sample copy" },
  { year: "2024", event: "Working together" },
  { year: "2025", event: "Key point" },
  { year: "2026", event: "Sample body copy goes here" },
];

export function HistoryTimeline({ class: cls }: { class?: string }) {
  return <HistoryTimelineBase entries={HISTORY_ENTRIES} class={cls} />;
}

/* ---------------------------------------------------------------------- */
/* LocationList — content/company/locations.mdx                           */
/* ---------------------------------------------------------------------- */

const LOCATION_GROUPS: LocationGroup[] = [
  {
    heading: "Domestic offices",
    locations: [
      { name: "North Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Central Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "West Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "South Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
    ],
  },
  {
    heading: "Research and production",
    locations: [
      { name: "Sample Research Center", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Sample Manufacturing Center", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "East Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Coastal Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Metro Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Harbor Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "River Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Hillside Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
      { name: "Island Sales Office", postal: "ZIP 000-0000", place: "Sample City, Example Country" },
    ],
  },
  {
    heading: "International network",
    locations: [
      { name: "Dummy Enterprises Ltd.", place: "Demo" },
      { name: "Dummy Taiwan Ltd.", place: "Sample" },
      { name: "Dummy Singapore Pte. Ltd.", place: "—" },
      { name: "Dummy Enterprises (Shanghai) Ltd.", place: "Demo" },
      { name: "Dummy America Inc.", place: "Sample" },
      { name: "Dummy Czech s.r.o.", place: "—" },
      { name: "Dummy India Pvt. Ltd.", place: "Demo" },
    ],
  },
];

export function LocationList({ class: cls }: { class?: string }) {
  return <LocationListBase groups={LOCATION_GROUPS} class={cls} />;
}

/* ---------------------------------------------------------------------- */
/* GroupCompanyGrid — content/company/group.mdx                           */
/* ---------------------------------------------------------------------- */

const GROUP_COMPANIES: GroupCompany[] = [
  {
    name: "Demo Precision Ltd.",
    business: "Fictional precision-manufacturing support.",
    established: "Sample founding date",
    location: "Sample City, Example Country",
  },
  {
    name: "Demo Logistics Ltd.",
    business: "Fictional logistics and supply-chain support.",
    established: "Sample founding date",
  },
  {
    name: "Demo Laboratory Ltd.",
    business: "Fictional research and testing support.",
    established: "Sample founding date",
    location: "Sample City, Example Country",
  },
];

export type GroupCompanyGridSectionProps = {
  heading?: string;
  intro?: string;
  bare?: boolean;
  class?: string;
};

export function GroupCompanyGrid(props: GroupCompanyGridSectionProps) {
  return <GroupCompanyGridBase {...props} companies={GROUP_COMPANIES} />;
}

/* ---------------------------------------------------------------------- */
/* ProductCategoryGrid — content/products/index.mdx                       */
/* ---------------------------------------------------------------------- */

const PRODUCT_CATEGORIES = BUSINESS_SEGMENTS.map((s) => ({
  title: s.title,
  tagline: s.tagline,
  items: s.items,
  href: s.href,
}));

export type ProductCategoryGridSectionProps = {
  heading?: string;
  intro?: string;
  bare?: boolean;
  class?: string;
};

export function ProductCategoryGrid(props: ProductCategoryGridSectionProps) {
  return <ProductCategoryGridBase {...props} categories={PRODUCT_CATEGORIES} />;
}

/* ---------------------------------------------------------------------- */
/* StrengthList — content/products/strengths.mdx                          */
/* ---------------------------------------------------------------------- */

const STRENGTHS: Strength[] = [
  {
    no: "01",
    title: "Integrated perspective",
    body: "A fictional portfolio shows how related capabilities can be explained in one clear story.",
  },
  {
    no: "02",
    title: "Practical expertise",
    body: "Sample content makes room for technical details without overwhelming the reader.",
  },
  {
    no: "03",
    title: "Adaptable operations",
    body: "A flexible system can present the same fictional business in different contexts.",
  },
  {
    no: "04",
    title: "Long-term partnerships",
    body: "Clear navigation helps visitors find the right next step in a fictional customer journey.",
  },
];

export type StrengthListSectionProps = {
  heading?: string;
  bare?: boolean;
  class?: string;
};

export function StrengthList(props: StrengthListSectionProps) {
  return <StrengthListBase {...props} strengths={STRENGTHS} />;
}

/* ---------------------------------------------------------------------- */
/* BusinessLinePortal — landing page + content/products/equipment.mdx     */
/* ---------------------------------------------------------------------- */

const PORTAL_LINES = BUSINESS_LINE_LIST.map((line) => ({
  key: line.key,
  label: line.label,
  description: line.description,
  href: line.homeHref,
}));

export type BusinessLinePortalSectionProps = {
  heading?: string;
  intro?: string;
  only?: string[];
  bare?: boolean;
  class?: string;
};

export function BusinessLinePortal(props: BusinessLinePortalSectionProps) {
  return <BusinessLinePortalBase {...props} lines={PORTAL_LINES} />;
}

/* ---------------------------------------------------------------------- */
/* FinancialHighlights — content/ir/financials.mdx                        */
/* ---------------------------------------------------------------------- */

const FINANCIAL_METRICS: FinancialMetric[] = [
  { label: "Revenue", unit: "Sample units" },
  { label: "Operating profit", unit: "Sample units" },
  { label: "Net income", unit: "Sample units" },
  { label: "Total assets", unit: "Sample units" },
  { label: "Earnings per share", unit: "Sample units" },
  { label: "Dividend per share", unit: "Sample units" },
];

export type FinancialHighlightsSectionProps = {
  heading?: string;
  intro?: string;
  pendingLabel?: string;
  bare?: boolean;
  class?: string;
};

export function FinancialHighlights(props: FinancialHighlightsSectionProps) {
  return <FinancialHighlightsBase {...props} metrics={FINANCIAL_METRICS} />;
}

/* ---------------------------------------------------------------------- */
/* CertList — content/sustainability/iso.mdx                              */
/* ---------------------------------------------------------------------- */

const CERTS: Cert[] = [
  {
    code: "Sample",
    name: "Reliable foundations",
    scope: "The quick brown fox jumps over the lazy dog.",
  },
  {
    code: "Demo",
    name: "Working together",
    scope: "This is sample copy.",
  },
];

export type CertListSectionProps = {
  heading?: string;
  bare?: boolean;
  class?: string;
};

export function CertList(props: CertListSectionProps) {
  return <CertListBase {...props} certs={CERTS} />;
}

/* ---------------------------------------------------------------------- */
/* InitiativeGrid — content/sustainability/environment.mdx                */
/* ---------------------------------------------------------------------- */

const INITIATIVES: Initiative[] = [
  {
    title: "Product stewardship",
    body: "A fictional example of considering materials, use, and end-of-life together.",
  },
  { title: "Resource awareness", body: "A fictional example of making everyday operations easier to understand." },
  {
    title: "Workplace well-being",
    body: "A fictional example of creating a supportive place to do useful work.",
  },
  { title: "Ethical governance", body: "A fictional example of sharing accountability clearly and consistently." },
  {
    title: "Community dialogue",
    body: "A fictional example of listening to the people and places around a business.",
  },
];

export type InitiativeGridSectionProps = {
  heading?: string;
  intro?: string;
  bare?: boolean;
  class?: string;
};

export function InitiativeGrid(props: InitiativeGridSectionProps) {
  return <InitiativeGridBase {...props} initiatives={INITIATIVES} />;
}

/* ---------------------------------------------------------------------- */
/* ValuePillars — content/new-business/index.mdx                          */
/* ---------------------------------------------------------------------- */

const VALUE_PILLARS: ValuePillar[] = [
  {
    title: "Curiosity",
    body: "Fictional teams start with thoughtful questions and the willingness to test an idea.",
  },
  {
    title: "Collaboration",
    body: "Fictional teams bring different perspectives together around a shared next step.",
  },
  {
    title: "Practical experimentation",
    body: "Fictional teams learn by turning a small, useful experiment into a clearer decision.",
  },
];

export type ValuePillarsSectionProps = {
  heading?: string;
  intro?: string;
  bare?: boolean;
  class?: string;
};

export function ValuePillars(props: ValuePillarsSectionProps) {
  return <ValuePillarsBase {...props} pillars={VALUE_PILLARS} />;
}

/* ---------------------------------------------------------------------- */
/* NewsList (live) — content/news/index.mdx, content/ir/news.mdx          */
/* ---------------------------------------------------------------------- */

export type NewsListSectionProps = {
  category?: string;
  limit?: number;
  showFilter?: boolean;
  heading?: string;
  class?: string;
};

export function NewsList({ category, limit, showFilter, heading, class: cls }: NewsListSectionProps) {
  const items = getNews({ category, limit });
  return <NewsListBase items={items} showFilter={showFilter} heading={heading} class={cls} />;
}
