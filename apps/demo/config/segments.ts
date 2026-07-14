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
 * `content/lines/<key>/..`) — segments and lines are two independent
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
    title: "Electronic Devices",
    tagline: "Reliable foundations",
    summary: "The quick brown fox jumps over the lazy dog.",
    items: ["Demo", "Sample", "—"],
    href: "/products/electronic-devices",
  },
  {
    key: "components",
    title: "Components",
    tagline: "Sample copy",
    summary:
      "The quick brown fox jumps over the lazy dog.",
    items: ["Demo", "Sample", "—"],
    href: "/products/components",
  },
  {
    key: "equipment",
    title: "Equipment",
    tagline: "A practical example",
    summary: "The quick brown fox jumps over the lazy dog.",
    items: ["Demo", "Sample", "—"],
    href: "/products/equipment",
  },
  {
    key: "chemical",
    title: "Chemical Products",
    tagline: "Working together",
    summary:
      "The quick brown fox jumps over the lazy dog.",
    items: ["Demo", "Sample", "—"],
    href: "/products/chemical",
  },
];
