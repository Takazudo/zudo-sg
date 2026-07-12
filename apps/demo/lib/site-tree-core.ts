/**
 * Site tree derivation — the zfb-free half.
 *
 * Split out from site-tree.ts so it has no `@takazudo/zfb` import and can be
 * unit-tested directly (see `__tests__/site-tree.test.ts`) — importing
 * `@takazudo/zfb/content` pulls in a `react/jsx-runtime` import that Vitest's
 * SSR module loader doesn't alias to `preact/jsx-runtime` (unlike Vite's app
 * build, which does), so a test file that merely imports `getSiteTree`
 * (never calling it) already fails to load. `site-tree.ts` re-exports
 * everything here, plus `getSiteTree` itself (the `getCollection` caller).
 *
 * See site-tree.ts's module doc for the "why" behind the design (frontmatter-
 * driven grouping, business-line scoping, etc.) — this file is the "how".
 */
import type { ContentData } from "./content-schema";

type NavFrontmatter = ContentData;

/** One page (a leaf link). */
export type NavLeaf = {
  label: string;
  href: string;
  slug: string;
  order: number;
};

/** One section (a nav accordion panel / footer column). */
export type NavSection = {
  label: string;
  /** Section-top link, if the section has an index page distinct from its children. */
  href?: string;
  order: number;
  children: NavLeaf[];
};

/** The full nav/sitemap tree. */
export type SiteTree = {
  sections: NavSection[];
};

const BASE = "/";

/**
 * Strips a trailing `index` segment (directory-index convention). E.g.
 * `company/index` → `company`, `index` → ``, `company/profile` → unchanged.
 * The content collection returns `company/index.md` as slug `company/index`,
 * but routes/links use the directory form `/company` — used consistently by
 * route generation and href generation to avoid 404s.
 */
export function normalizeSlug(slug: string): string {
  return slug
    .replace(/^\/+|\/+$/g, "")
    .replace(/(^|\/)index$/, "")
    .replace(/\/+$/, "");
}

/** Converts a slug to an href (base-prefixed; no trailing slash — trailingSlash: false). */
export function slugToHref(slug: string): string {
  const normalized = normalizeSlug(slug);
  return normalized === "" ? BASE : `${BASE}${normalized}`;
}

/** Builds a naive label from a slug's last segment (last resort when navLabel/title are absent). */
function fallbackLabel(slug: string): string {
  const last = slug.split("/").filter(Boolean).pop() ?? slug;
  return last.replace(/[-_]/g, " ");
}

/**
 * One entry to feed into tree derivation.
 * - `slug`: the real slug used to build hrefs (bare for the corporate scope,
 *   full `lines/<key>/...` form for line scope).
 * - `sectionSlug`: slug used to derive the section grouping. Defaults to
 *   `slug`. Line-scoped entries pass the line-relative slug (prefix
 *   stripped) so the section isn't literally "lines"/"<key>".
 */
export type TreeEntry = { slug: string; data?: NavFrontmatter; sectionSlug?: string };

/**
 * Pure tree-building function — derives sections from raw entries. Exposed
 * separately from {@link getSiteTree} so tests can feed in fixtures without
 * going through `getCollection`.
 */
export function buildTreeFromEntries(entries: TreeEntry[]): NavSection[] {
  const sectionMap = new Map<string, NavSection>();
  const sectionOrderHint = new Map<string, number>();
  const sectionSlugToEntry = new Map<string, TreeEntry>();
  const sectionFirstSeg = new Map<string, string>();

  const secSlugOf = (entry: TreeEntry): string => entry.sectionSlug ?? entry.slug;

  for (const entry of entries) {
    sectionSlugToEntry.set(secSlugOf(entry), entry);
  }

  for (const entry of entries) {
    const data = entry.data ?? {};
    const secSlug = secSlugOf(entry);

    // Section: frontmatter.section wins; otherwise the section-slug's first segment.
    // Registered even for navHidden entries — needed to resolve the section-top href below.
    const firstSeg = secSlug.split("/").filter(Boolean)[0] ?? secSlug;
    const sectionLabel = data.section ?? firstSeg;

    if (!sectionFirstSeg.has(sectionLabel)) {
      sectionFirstSeg.set(sectionLabel, firstSeg);
    }

    if (data.navHidden) continue;

    let section = sectionMap.get(sectionLabel);
    if (!section) {
      section = {
        label: sectionLabel,
        order: Number.POSITIVE_INFINITY,
        children: [],
      };
      sectionMap.set(sectionLabel, section);
    }

    if (typeof data.sectionOrder === "number") {
      const prev = sectionOrderHint.get(sectionLabel) ?? Number.POSITIVE_INFINITY;
      sectionOrderHint.set(sectionLabel, Math.min(prev, data.sectionOrder));
    }

    section.children.push({
      label: data.navLabel ?? data.title ?? fallbackLabel(entry.slug),
      href: slugToHref(entry.slug),
      slug: entry.slug,
      order: typeof data.navOrder === "number" ? data.navOrder : Number.POSITIVE_INFINITY,
    });
  }

  // Resolve each section's top-level link: an index page (or standalone page)
  // at the section's first segment, if one exists and isn't just one of the
  // section's own children (which would make the section link to itself).
  for (const [label, section] of sectionMap) {
    const seg = sectionFirstSeg.get(label);
    if (seg) {
      const indexEntry = sectionSlugToEntry.get(`${seg}/index`) ?? sectionSlugToEntry.get(seg);
      if (indexEntry) {
        const isOwnLeaf = section.children.some(
          (c) => normalizeSlug(c.slug) === normalizeSlug(indexEntry.slug),
        );
        if (!isOwnLeaf) section.href = slugToHref(indexEntry.slug);
      }
    }
    const hint = sectionOrderHint.get(label);
    if (typeof hint === "number") section.order = hint;
  }

  for (const section of sectionMap.values()) {
    section.children.sort(byOrderThenLabel);
  }

  return [...sectionMap.values()].sort(byOrderThenLabel);
}

function byOrderThenLabel(
  a: { order: number; label: string },
  b: { order: number; label: string },
): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.label.localeCompare(b.label);
}

/** Whether a normalized slug is under the given line (`lines/<key>` or `lines/<key>/...`). */
export function isUnderLine(normalizedSlug: string, lineKey: string): boolean {
  return normalizedSlug === `lines/${lineKey}` || normalizedSlug.startsWith(`lines/${lineKey}/`);
}

/** Whether a normalized slug is under any line (used to exclude lines/ from the corporate scope). */
export function isUnderAnyLine(normalizedSlug: string): boolean {
  return normalizedSlug === "lines" || normalizedSlug.startsWith("lines/");
}

/**
 * Scopes raw collection entries to either the corporate tree (everything
 * outside `lines/`) or one line's tree (`lines/<key>/...`, prefix stripped
 * for section derivation), normalizing slugs on both sides.
 */
export function scopeEntries(
  entries: Array<{ slug: string; data?: NavFrontmatter }>,
  lineKey?: string,
): TreeEntry[] {
  const result: TreeEntry[] = [];
  for (const entry of entries) {
    const norm = normalizeSlug(entry.slug);
    if (lineKey) {
      if (!isUnderLine(norm, lineKey)) continue;
      const prefix = `lines/${lineKey}`;
      const rel = norm === prefix ? "" : norm.slice(prefix.length + 1);
      // The line's own home page isn't a nav item (it's reached via the brand/switcher).
      if (rel === "") continue;
      result.push({ slug: norm, data: entry.data, sectionSlug: rel });
    } else {
      if (isUnderAnyLine(norm)) continue;
      result.push({ slug: norm, data: entry.data });
    }
  }
  return result;
}

/** One breadcrumb. The last crumb (current page) omits `href`. */
export type Crumb = { label: string; href?: string };

/**
 * Builds breadcrumbs for the current slug from the (already scoped) tree.
 *
 * @param lineKey When set, prepends a line-home crumb before resolving the
 *   rest against the (line-scoped) tree. The line label is the raw key
 *   (see site-tree.ts's module doc) until a richer per-line registry lands.
 */
export function getBreadcrumbs(slug: string | undefined, tree: SiteTree, lineKey?: string): Crumb[] {
  const home: Crumb = { label: "Home", href: BASE };
  const normSlug = normalizeSlug(slug ?? "");

  if (lineKey) {
    const lineHome: Crumb = { label: lineKey, href: slugToHref(`lines/${lineKey}`) };
    const prefix = `lines/${lineKey}`;
    const rel = normSlug === prefix ? "" : normSlug.slice(prefix.length + 1);
    if (rel === "") {
      return [home, { label: lineKey }];
    }
    const tail = resolveTreeCrumbs(normSlug, tree, rel);
    return [home, lineHome, ...tail];
  }

  if (normSlug === "") {
    return [home];
  }
  return [home, ...resolveTreeCrumbs(normSlug, tree)];
}

/**
 * Resolves the section/page tail of the breadcrumb trail from the tree.
 * Falls back to a naive segment split when the slug isn't in the tree yet
 * (e.g. a page not registered in any section).
 */
function resolveTreeCrumbs(normFullSlug: string, tree: SiteTree, fallbackSlug?: string): Crumb[] {
  const targetHref = slugToHref(normFullSlug);
  for (const section of tree.sections) {
    const leaf = section.children.find((c) => normalizeSlug(c.slug) === normFullSlug);
    if (leaf) {
      return [{ label: section.label, href: section.href }, { label: leaf.label }];
    }
    if (section.href && section.href === targetHref) {
      return [{ label: section.label }];
    }
  }

  const fbSegs = (fallbackSlug ?? normFullSlug).split("/").filter(Boolean);
  const fullSegs = normFullSlug.split("/").filter(Boolean);
  const prefixLen = fullSegs.length - fbSegs.length;
  return fbSegs.map((seg, i) => {
    const isLast = i === fbSegs.length - 1;
    const fullSub = fullSegs.slice(0, prefixLen + i + 1).join("/");
    return { label: seg.replace(/[-_]/g, " "), href: isLast ? undefined : slugToHref(fullSub) };
  });
}
