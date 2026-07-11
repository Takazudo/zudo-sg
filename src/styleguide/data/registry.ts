// Styleguide data layer — turns the raw story modules map into the catalog's
// navigable, slug-addressable model.
//
// Discovery itself lives in `src/styleguide/data/sg-registry.ts` (see
// that file's header for the no-glob rationale). This module is pure data
// shaping over that map: it is SSR-safe (no DOM, no fs, no async) so every
// page and the preview app can import it freely.

import type { StoryCategory, StoryMeta, Story } from "@zudo-sg/ui";
import { storyModules, storyExportOrder } from "./sg-registry";

/** Declared category order — mirrors the closed union in @zudo-sg/ui/stories/types. */
export const CATEGORY_ORDER: StoryCategory[] = [
  // GENERATED:STORY_CATEGORIES_BEGIN — do not hand-edit; run pnpm gen:story-categories.
  // Source of truth: packages/ui/src/stories/types.ts (STORY_CATEGORIES).
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  // GENERATED:STORY_CATEGORIES_END
];

/**
 * Slugs reserved by the styleguide chrome's leading sidebar leaves — Overview
 * (route "/components") and Design Tokens (route "/components/tokens"). These are NOT story slugs.
 * `buildEntries()` seeds the de-dupe set with them so a future story whose
 * title slugifies to one of these (e.g. a story titled "Tokens" → "tokens")
 * is auto-suffixed (→ "tokens-2") instead of colliding with the chrome route
 * and the sidebar's active-item highlight. `nav-nodes.ts` consumes these same
 * constants for its reserved leaves (single source of truth for the contract).
 */
export const OVERVIEW_SLUG = "";
export const TOKENS_SLUG = "tokens";
const RESERVED_NAV_SLUGS: readonly string[] = [OVERVIEW_SLUG, TOKENS_SLUG];

/** One discovered story file, normalised. */
export interface StoryEntry {
  /** URL slug, derived from meta.title (kebab-cased). Unique. */
  slug: string;
  /** Glob path key (e.g. `./ui/src/button/button.stories.tsx`). */
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

function slugify(input: string): string {
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

function buildEntries(): StoryEntry[] {
  const entries: StoryEntry[] = [];
  // Seed with the chrome-reserved slugs so a colliding story title is suffixed
  // rather than overlapping the Overview / Design Tokens routes + highlight.
  const seenSlugs = new Set<string>(RESERVED_NAV_SLUGS);

  for (const [path, mod] of Object.entries(storyModules)) {
    const meta = mod.default as StoryMeta | undefined;
    if (!meta || typeof meta.title !== "string") {
      // A story file with no valid meta default export is a contract violation;
      // skip it rather than crash the whole catalog build.
      continue;
    }

    const variants: VariantEntry[] = [];
    for (const [exportName, value] of Object.entries(mod)) {
      if (exportName === "default") continue;
      if (!isStory(value)) continue;
      variants.push({ exportName, name: value.name, story: value });
    }
    if (variants.length === 0) continue;

    // `Object.entries(mod)` above enumerates the ES-module namespace's keys
    // alphabetically, so re-sort into authored source order using the codegen-
    // emitted list (superset of any `export const` — used only to rank, never
    // to gate; unknown exports sort to the end, preserving their relative order
    // via a stable sort). This fixes both tab order and the default tab
    // (`variants[0]`). See #128 / #174.
    // Rank unknowns as `order.length` (a FINITE sentinel past every known
    // index), not Infinity — two unknowns would make `Infinity - Infinity` NaN,
    // an undefined comparator result. In practice every variant is in the
    // superset, so this is purely defensive.
    const order = storyExportOrder[path] ?? [];
    const rank = (name: string): number => {
      const i = order.indexOf(name);
      return i === -1 ? order.length : i;
    };
    variants.sort((a, b) => rank(a.exportName) - rank(b.exportName));

    let slug = slugify(meta.title);
    // De-dupe defensively (titles are unique-within-category by contract, but
    // two categories could share a title).
    let n = 2;
    while (seenSlugs.has(slug)) slug = `${slugify(meta.title)}-${n++}`;
    seenSlugs.add(slug);

    entries.push({ slug, path, meta, variants });
  }

  return entries;
}

/** All discovered stories (cached at module init — eager + synchronous). */
export const storyEntries: StoryEntry[] = buildEntries();

const entryBySlug = new Map<string, StoryEntry>(
  storyEntries.map((e) => [e.slug, e]),
);

export function getStoryBySlug(slug: string): StoryEntry | undefined {
  return entryBySlug.get(slug);
}

export function getAllSlugs(): string[] {
  return storyEntries.map((e) => e.slug);
}

/** A category bucket for the catalog landing + sidebar. */
export interface CategoryGroup {
  category: StoryCategory;
  stories: StoryEntry[];
}

/**
 * Stories grouped by category, in the declared CATEGORY_ORDER. Within a
 * category, sort by `meta.order` (ascending) then alphabetically by title.
 * Empty categories are omitted.
 */
export function getCategoryGroups(): CategoryGroup[] {
  const byCategory = new Map<StoryCategory, StoryEntry[]>();
  for (const entry of storyEntries) {
    const list = byCategory.get(entry.meta.category) ?? [];
    list.push(entry);
    byCategory.set(entry.meta.category, list);
  }

  const groups: CategoryGroup[] = [];
  for (const category of CATEGORY_ORDER) {
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
