/**
 * Business segment registry — the single source for the demo's 4 product
 * segments (label / tagline / summary / representative items / href).
 *
 * `ProductCategoryGrid` (content/products/index.mdx) and `BusinessSegments`
 * (landing page) both derive their card data from `BUSINESS_SEGMENTS` so the
 * two surfaces can't drift apart — see `pages/_mdx-content-sections.tsx` and
 * `pages/index.tsx`.
 *
 * Orthogonal to the business "lines" dimension (config/lines.ts,
 * `content/lines/<key>/...`) — segments and lines are two independent
 * taxonomies over the same fictional dummy product catalog.
 *
 * Labels are fictional dummy Japanese placeholder copy (matching the ported
 * content collection's language), not real product/segment data.
 */

export type BusinessSegment = {
  /** Segment key — matches the href's trailing path segment. */
  key: string;
  /** Card heading. */
  title: string;
  /** Short tagline (product-top card grid). */
  tagline: string;
  /** One-sentence summary (landing-page card). */
  summary: string;
  /** Representative items, shown as a chip/bullet list. */
  items: string[];
  /** Internal href to the segment's detail page (no trailing slash). */
  href: string;
};

export const BUSINESS_SEGMENTS: BusinessSegment[] = [
  {
    key: "electronic-devices",
    title: "ダミー区分1",
    tagline: "ダミー見出し",
    summary: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
    items: ["ダミー", "サンプル", "――"],
    href: "/products/electronic-devices",
  },
  {
    key: "components",
    title: "ダミー区分2",
    tagline: "ダミーテキスト",
    summary:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
    items: ["ダミー", "サンプル", "――"],
    href: "/products/components",
  },
  {
    key: "equipment",
    title: "ダミー区分3",
    tagline: "サンプルタイトル",
    summary: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
    items: ["ダミー", "サンプル", "――"],
    href: "/products/equipment",
  },
  {
    key: "chemical",
    title: "ダミー区分4",
    tagline: "見出しダミー",
    summary:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
    items: ["ダミー", "サンプル", "――"],
    href: "/products/chemical",
  },
];
