// Story registry — turns a host's story-modules map into the catalog's
// navigable, slug-addressable model.
//
// Discovery is host-side codegen (the generated registry file exports
// `storyModules` + `storyExportOrder`); this module only shapes that data. It
// is pure and SSR-safe (no DOM, no fs, no async), so every route and the
// preview app can build or import a registry freely.

import type { Story, StoryMeta, StoryModule } from "../stories/types.js";

/**
 * Slugs reserved by the styleguide chrome — Overview (the components index
 * route) and Design Tokens (the tokens route). They are NOT story slugs: a
 * story whose title slugifies to one of them is auto-suffixed (`tokens-2`).
 * Keep "tokens" reserved so the retired component URL stays unavailable.
 */
export const OVERVIEW_SLUG = "";
export const TOKENS_SLUG = "tokens";
const RESERVED_NAV_SLUGS: readonly string[] = [OVERVIEW_SLUG, TOKENS_SLUG];

/** One discovered story file, normalised. */
export interface StoryEntry {
  /** URL slug, derived from meta.title (kebab-cased). Unique. */
  slug: string;
  /** Registry path key (e.g. `./ui/src/button/button.stories.tsx`). */
  path: string;
  meta: StoryMeta;
  /**
   * Variants (named Story exports) in SOURCE order — sorted by the codegen-
   * emitted `storyExportOrder`, NOT by `Object.entries(mod)` (an ES-module
   * namespace enumerates keys alphabetically per spec). `variants[0]` is the
   * first-authored story, which drives the default-selected code-panel tab.
   */
  variants: VariantEntry[];
}

/** One variant (named Story export) of a story file. */
export interface VariantEntry {
  /** Export name (e.g. `Variants`) — stable id used in the preview URL. */
  exportName: string;
  /** Human label from `Story.name`. */
  name: string;
  story: Story;
}

/** A category bucket for the catalog landing + sidebar. */
export interface CategoryGroup {
  category: string;
  stories: StoryEntry[];
}

export interface CreateRegistryOptions {
  /**
   * Host-declared category order. Listed categories render first in this
   * order; categories used by a story but not listed are appended
   * alphabetically (never dropped).
   */
  categoryOrder?: readonly string[];
  /** Codegen-emitted source order of each story file's exports, keyed like `storyModules`. */
  storyExportOrder?: Readonly<Record<string, readonly string[]>>;
}

export interface Registry {
  /** Full group order: `categoryOrder` (deduped) + unlisted used categories, alphabetical. */
  categoryOrder: string[];
  /** All discovered stories, in registry-map order. */
  storyEntries: StoryEntry[];
  getStoryBySlug(slug: string): StoryEntry | undefined;
  getAllSlugs(): string[];
  /**
   * Stories grouped by category in `categoryOrder`; within a category sorted
   * by `meta.order` (ascending) then title. Empty categories are omitted.
   */
  getCategoryGroups(): CategoryGroup[];
}

export function slugify(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isStory(value: unknown): value is Story {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Story).name === "string" &&
    typeof (value as Story).render === "function"
  );
}

function readMeta(mod: StoryModule): StoryMeta | undefined {
  const meta = mod.default as StoryMeta | undefined;
  return meta && typeof meta.title === "string" ? meta : undefined;
}

export function computeCategoryOrder(
  storyModules: Readonly<Record<string, StoryModule>>,
  declared: readonly string[] = [],
): string[] {
  const listed = [...new Set(declared)];
  const listedSet = new Set(listed);
  const unlisted = new Set<string>();
  for (const mod of Object.values(storyModules)) {
    const category = readMeta(mod)?.category;
    if (typeof category === "string" && !listedSet.has(category)) unlisted.add(category);
  }
  return [...listed, ...[...unlisted].sort((a, b) => a.localeCompare(b))];
}

function buildEntries(
  storyModules: Readonly<Record<string, StoryModule>>,
  storyExportOrder: Readonly<Record<string, readonly string[]>>,
): StoryEntry[] {
  const entries: StoryEntry[] = [];
  const seenSlugs = new Set<string>(RESERVED_NAV_SLUGS);

  for (const [path, mod] of Object.entries(storyModules)) {
    // A story file with no valid meta default export violates the contract;
    // skip it rather than crash the whole catalog build.
    const meta = readMeta(mod);
    if (!meta) continue;

    const variants: VariantEntry[] = [];
    for (const [exportName, value] of Object.entries(mod)) {
      if (exportName === "default") continue;
      if (!isStory(value)) continue;
      variants.push({ exportName, name: value.name, story: value });
    }
    if (variants.length === 0) continue;

    // Re-sort into authored source order (#128 / #174). The export-order list
    // only ranks, never gates: unknown exports sort after known ones, keeping
    // their relative order (stable sort). `order.length` is a finite sentinel
    // — two `Infinity` ranks would make the comparator return NaN.
    const order = storyExportOrder[path] ?? [];
    const rank = (name: string): number => {
      const i = order.indexOf(name);
      return i === -1 ? order.length : i;
    };
    variants.sort((a, b) => rank(a.exportName) - rank(b.exportName));

    const base = slugify(meta.title);
    let slug = base;
    let n = 2;
    while (seenSlugs.has(slug)) slug = `${base}-${n++}`;
    seenSlugs.add(slug);

    entries.push({ slug, path, meta, variants });
  }

  return entries;
}

/**
 * Builds a registry from the host's generated story-modules map. Call once
 * per module graph (the result is immutable data plus lookups); the returned
 * functions do not rely on `this`, so they can be destructured.
 */
export function createRegistry(
  storyModules: Readonly<Record<string, StoryModule>>,
  options: CreateRegistryOptions = {},
): Registry {
  const categoryOrder = computeCategoryOrder(storyModules, options.categoryOrder);
  const storyEntries = buildEntries(storyModules, options.storyExportOrder ?? {});
  const entryBySlug = new Map(storyEntries.map((e) => [e.slug, e]));

  function getCategoryGroups(): CategoryGroup[] {
    const byCategory = new Map<string, StoryEntry[]>();
    for (const entry of storyEntries) {
      const list = byCategory.get(entry.meta.category) ?? [];
      list.push(entry);
      byCategory.set(entry.meta.category, list);
    }

    const groups: CategoryGroup[] = [];
    for (const category of categoryOrder) {
      const stories = byCategory.get(category);
      if (!stories || stories.length === 0) continue;
      stories.sort((a, b) => {
        const oa = a.meta.order ?? Number.POSITIVE_INFINITY;
        const ob = b.meta.order ?? Number.POSITIVE_INFINITY;
        if (oa !== ob) return oa - ob;
        return a.meta.title.localeCompare(b.meta.title);
      });
      groups.push({ category, stories });
    }
    return groups;
  }

  return {
    categoryOrder,
    storyEntries,
    getStoryBySlug: (slug) => entryBySlug.get(slug),
    getAllSlugs: () => storyEntries.map((e) => e.slug),
    getCategoryGroups,
  };
}
