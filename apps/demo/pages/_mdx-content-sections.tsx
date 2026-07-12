/**
 * Bound MDX section components — thin wrappers pairing the generic,
 * prop-driven `@zudo-sg/ui` section components with this demo's own
 * fictional dummy dataset, registered under the same tag names the content
 * collection already uses (`<CompanyProfileTable />`, `<HistoryTimeline />`,
 * ...) — see `_mdx-components.ts`, which registers these (not the raw
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
  { label: "会社名", value: "ダミー株式会社（Dummy Co., Ltd.）" },
  { label: "設立", value: "――" },
  { label: "資本金", value: "00億円" },
  { label: "代表者", value: "ダミー" },
  { label: "本社所在地", value: "〒000-0000　ダミー都ダミー区ダミー1-1-1" },
  { label: "上場市場", value: "サンプル" },
  { label: "従業員数", value: "連結 1,234名 / 単体 99名" },
  { label: "売上高", value: "連結 00億円 / 単体 00億円" },
  { label: "事業内容", value: "サンプル本文がここに入ります" },
  { label: "主要取引銀行", value: "ダミー、サンプル、――" },
];

export function CompanyProfileTable({ class: cls }: { class?: string }) {
  return <CompanyProfileTableBase rows={COMPANY_PROFILE_ROWS} class={cls} />;
}

/* ---------------------------------------------------------------------- */
/* HistoryTimeline — content/company/history.mdx                          */
/* ---------------------------------------------------------------------- */

const HISTORY_ENTRIES: HistoryEntry[] = [
  { year: "1953", event: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。" },
  {
    year: "1958",
    event: "彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。",
  },
  {
    year: "1961",
    event: "それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。",
  },
  { year: "1963", event: "ダミー見出し" },
  {
    year: "1970",
    event:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  { year: "1973", event: "ダミーテキスト" },
  { year: "1974", event: "サンプルタイトル" },
  { year: "1977", event: "これはダミーのテキストです" },
  { year: "1980", event: "見出しダミー" },
  { year: "1991", event: "ダミー項目" },
  {
    year: "1995",
    event:
      "誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。",
  },
  { year: "1999", event: "サンプル本文がここに入ります" },
  {
    year: "2000",
    event: "彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。",
  },
  {
    year: "2002",
    event: "それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。",
  },
  { year: "2003", event: "ダミー見出し" },
  { year: "2016", event: "ダミーテキスト" },
  { year: "2018", event: "サンプルタイトル" },
  { year: "2022", event: "これはダミーのテキストです" },
  { year: "2024", event: "見出しダミー" },
  { year: "2025", event: "ダミー項目" },
  { year: "2026", event: "サンプル本文がここに入ります" },
];

export function HistoryTimeline({ class: cls }: { class?: string }) {
  return <HistoryTimelineBase entries={HISTORY_ENTRIES} class={cls} />;
}

/* ---------------------------------------------------------------------- */
/* LocationList — content/company/locations.mdx                           */
/* ---------------------------------------------------------------------- */

const LOCATION_GROUPS: LocationGroup[] = [
  {
    heading: "ダミー見出し",
    locations: [
      { name: "関西支店", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "名古屋支店", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "福岡営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "第二事業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1" },
    ],
  },
  {
    heading: "サンプルタイトル",
    locations: [
      { name: "四日市研究所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1" },
      { name: "四日市工場", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-2-1" },
      { name: "中部営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-3-1" },
      { name: "千葉営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1" },
      { name: "神奈川営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "大阪営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "水島営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1" },
      { name: "岩国営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1 ダミービル" },
      { name: "大分営業所", postal: "〒000-0000", place: "ダミー県ダミー市ダミー1-1-1" },
    ],
  },
  {
    heading: "見出しダミー",
    locations: [
      { name: "Dummy Enterprises Ltd.", place: "ダミー" },
      { name: "Dummy Taiwan Ltd.", place: "サンプル" },
      { name: "Dummy Singapore Pte. Ltd.", place: "――" },
      { name: "Dummy Enterprises (Shanghai) Ltd.", place: "ダミー" },
      { name: "Dummy America Inc.", place: "サンプル" },
      { name: "Dummy Czech s.r.o.", place: "――" },
      { name: "Dummy India Pvt. Ltd.", place: "ダミー" },
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
    name: "ダミー精密成形株式会社",
    business: "サンプル本文がここに入ります",
    established: "0000年設立",
    location: "ダミー県ダミー市",
  },
  {
    name: "ダミーロジスティクス株式会社",
    business:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
    established: "0000年設立",
  },
  {
    name: "株式会社ダミーラボ",
    business: "ダミーテキスト",
    established: "0000年設立",
    location: "ダミー県ダミー市",
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
    title: "ダミー見出し",
    body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。",
  },
  {
    no: "02",
    title: "ダミーテキスト",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  {
    no: "03",
    title: "サンプルタイトル",
    body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。",
  },
  {
    no: "04",
    title: "見出しダミー",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
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
  { label: "ダミー見出し", unit: "百万円" },
  { label: "ダミーテキスト", unit: "百万円" },
  { label: "サンプルタイトル", unit: "百万円" },
  { label: "これはダミーのテキストです", unit: "百万円" },
  { label: "見出しダミー", unit: "円" },
  { label: "ダミー項目", unit: "円" },
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
    code: "サンプル",
    name: "ダミー見出し",
    scope: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
  },
  {
    code: "ダミー",
    name: "見出しダミー",
    scope: "これはダミーのテキストです。",
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
    title: "ダミー見出し",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  { title: "ダミーテキスト", body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。" },
  {
    title: "サンプルタイトル",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  { title: "これはダミーのテキストです", body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。" },
  {
    title: "見出しダミー",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
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
    title: "ダミー見出し",
    body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。彼のこの仕事への恐れを和らげるために、数多い仲間の中に同じ考えを抱き、彼を見守り、待っている者がいるというのか。それとも背後の足音の主は、この街に無数にいる法監視役で、強靭な罰をすぐにも彼の手首にガシャンと下すというのか。",
  },
  {
    title: "見出しダミー",
    body: "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
  },
  {
    title: "サンプルタイトル",
    body: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。誰がこんな夜更けに、しかもこんな街灯のお粗末な港街の狭い小道で彼をつけて来るというのだ。人生の航路を捻じ曲げ、その獲物と共に立ち去ろうとしている、その丁度今。",
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
