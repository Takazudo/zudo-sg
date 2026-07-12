/**
 * Business-line registry — the single source for the demo's 5 business
 * lines (brand label, home href, per-line theming accent key).
 *
 * Design intent:
 *   The demo has two content dimensions: the corporate site (everything
 *   outside `lines/`) and 5 business lines under `content/lines/<key>/...`
 *   (→ route `/lines/<key>/...`). `BusinessLinePortal` (landing page +
 *   `content/products/equipment.mdx`) derives its card data from
 *   `BUSINESS_LINE_LIST` so both call sites stay in sync — see
 *   `pages/_mdx-content-sections.tsx` and `pages/index.tsx`.
 *
 *   The active line for routing/breadcrumbs is derived structurally from the
 *   slug prefix by `lib/section-label.ts`'s `deriveLineKey` (no registry
 *   lookup there, by design — see that file's module doc). This registry is
 *   the complementary "look up a line's display metadata" half.
 *
 * Labels/domains/descriptions are fictional dummy placeholder copy (matching
 * the ported content collection's language), not real business data.
 *
 * URL convention: per `trailingSlash: false`, internal hrefs have no
 * trailing `/` (e.g. `/lines/vacuum`).
 */

/** Business-line key — matches the slug prefix `lines/<key>/` and URL `/lines/<key>`. */
export type LineKey = "vacuum" | "process" | "laser" | "meeting" | "beauty";

/**
 * Per-line theming accent key. `<html data-line="<key>">` (layouts/default.tsx)
 * is the CSS hook a later wave's `styles/lines.css` overrides Tier-2 semantic
 * tokens (`--color-accent` etc.) through. Currently every line has an accent,
 * so this is the same set as `LineKey` — kept as a separate alias so a future
 * line without its own accent doesn't silently widen this type too.
 */
export type LineAccent = LineKey;

/** One business line's full metadata — the single source for its card/nav/theming needs. */
export type BusinessLine = {
  /** Line identifier. Matches the slug prefix `lines/<key>/` and URL `/lines/<key>`. */
  key: LineKey;
  /** Per-line brand name. */
  brand: string;
  /** Short display label (nav/breadcrumbs/portal cards). */
  label: string;
  /** Internal href to the line's home page (no trailing slash). */
  homeHref: string;
  /** Independent-looking domain, shown in portal/switcher captions. */
  domain: string;
  /** 1-2 sentence description for portal cards. */
  description: string;
  /** Per-line theming accent key — the `[data-line="<key>"]` CSS hook. */
  accent: LineAccent;
};

export const BUSINESS_LINES: Record<LineKey, BusinessLine> = {
  vacuum: {
    key: "vacuum",
    brand: "ダミー分野A",
    label: "ダミー分野A",
    homeHref: "/lines/vacuum",
    domain: "dummy-vacuum.jp",
    description: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
    accent: "vacuum",
  },
  process: {
    key: "process",
    brand: "ダミー分野B",
    label: "ダミー分野B",
    homeHref: "/lines/process",
    domain: "process.dummy.co.jp",
    description:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
    accent: "process",
  },
  laser: {
    key: "laser",
    brand: "ダミー分野C",
    label: "ダミー分野C",
    homeHref: "/lines/laser",
    domain: "laser-dummy.jp",
    description: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
    accent: "laser",
  },
  meeting: {
    key: "meeting",
    brand: "ダミー分野D",
    label: "ダミー分野D",
    homeHref: "/lines/meeting",
    domain: "dummy-meeting.jp",
    description:
      "あのイーハトーヴォのすきとおった風、夏でも底に冷たさをもつ青いそら、うつくしい森で飾られたモリーオ市、郊外のぎらぎらひかる草の波。この物語はダミーテキストであり、実際の内容とは一切関係がありません。",
    accent: "meeting",
  },
  beauty: {
    key: "beauty",
    brand: "ダミーブランド skincare",
    label: "ダミー分野E",
    homeHref: "/lines/beauty",
    domain: "dummy-beauty.jp",
    description: "彼は背後にひそかな足音を聞いた。それはあまり良い意味を示すものではない。",
    accent: "beauty",
  },
};

/** Registry-order array form (portal/footer display order). */
export const BUSINESS_LINE_LIST: BusinessLine[] = Object.values(BUSINESS_LINES);

/** Type guard: is the string a registered {@link LineKey}? */
export function isLineKey(value: string | undefined | null): value is LineKey {
  return value != null && Object.prototype.hasOwnProperty.call(BUSINESS_LINES, value);
}

/** Looks up a line's metadata by key (undefined if unregistered). */
export function getLine(key: string | undefined | null): BusinessLine | undefined {
  return isLineKey(key) ? BUSINESS_LINES[key] : undefined;
}
