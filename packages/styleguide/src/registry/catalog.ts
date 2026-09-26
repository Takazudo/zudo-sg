// Mode-neutral catalog view (epic #879, E1). Catalog, nav, detail and search
// consume `CatalogEntry` so they work the same whether the host supplied
// StoryModules (module mode) or plain `StoryDescriptor`s (descriptor mode).

import type { StoryControl } from "../stories/types.js";
import type { StoryDescriptor, ThumbnailDescriptor } from "./descriptors.js";
import { compareByOrderThenTitle, orderCategories, type Registry, type StoryEntry } from "./registry.js";

/** One variant as the catalog sees it — no render function. */
export interface CatalogVariant {
  exportName: string;
  name: string;
  controls?: StoryControl[];
}

interface CatalogEntryBase {
  /** URL slug. Unique. */
  slug: string;
  /** Stable identity: the registry path key in module mode, the descriptor `id` in descriptor mode. */
  id: string;
  /** Registry path key (module mode) or the descriptor's `sourcePath`. */
  path?: string;
  title: string;
  /** Always a string; `""` when a descriptor omits it. */
  description: string;
  category: string;
  order?: number;
  /** Variants in authored order; `variants[0]` is the default selection. */
  variants: CatalogVariant[];
  thumbnail?: ThumbnailDescriptor;
}

/** Built from a `createRegistry()` entry; keeps the original for the SSR thumbnail and code panel. */
export interface ModuleCatalogEntry extends CatalogEntryBase {
  source: "module";
  storyEntry: StoryEntry;
}

/** Built from a validated `StoryDescriptor`. */
export interface DescriptorCatalogEntry extends CatalogEntryBase {
  source: "descriptor";
}

export type CatalogEntry = ModuleCatalogEntry | DescriptorCatalogEntry;

export interface CatalogCategoryGroup {
  category: string;
  stories: CatalogEntry[];
}

export interface CreateCatalogOptions {
  /** Host-declared category order; unlisted used categories append alphabetically. */
  categoryOrder?: readonly string[];
}

/** Same query surface as `Registry`, over `CatalogEntry`. */
export interface Catalog {
  /** Full group order: `categoryOrder` (deduped) + unlisted used categories, alphabetical. */
  categoryOrder: string[];
  /** All entries, in input order. */
  entries: CatalogEntry[];
  getStoryBySlug(slug: string): CatalogEntry | undefined;
  getAllSlugs(): string[];
  /** Entries grouped by category in `categoryOrder`, sorted by `order` then title. Empty categories are omitted. */
  getCategoryGroups(): CatalogCategoryGroup[];
}

/** Module-mode entries. Pass `registry.categoryOrder` to `createCatalog` for exact `createRegistry` parity. */
export function catalogEntriesFromRegistry(registry: Pick<Registry, "storyEntries">): ModuleCatalogEntry[] {
  return registry.storyEntries.map((entry) => ({
    slug: entry.slug,
    id: entry.path,
    path: entry.path,
    title: entry.meta.title,
    description: entry.meta.description ?? "",
    category: entry.meta.category,
    ...(entry.meta.order !== undefined && { order: entry.meta.order }),
    variants: entry.variants.map((v) => ({
      exportName: v.exportName,
      name: v.name,
      ...(v.story.controls !== undefined && { controls: v.story.controls as StoryControl[] }),
    })),
    source: "module",
    storyEntry: entry,
  }));
}

/** Descriptor-mode entries. Expects the output of `validateStoryDescriptors`; slugs are kept verbatim. */
export function catalogEntriesFromDescriptors(descriptors: readonly StoryDescriptor[]): DescriptorCatalogEntry[] {
  return descriptors.map((d) => ({
    slug: d.slug,
    id: d.id,
    ...(d.sourcePath !== undefined && { path: d.sourcePath }),
    title: d.title,
    description: d.description ?? "",
    category: d.category,
    ...(d.order !== undefined && { order: d.order }),
    variants: d.variants.map((v) => ({
      exportName: v.exportName,
      name: v.name,
      ...(v.controls !== undefined && { controls: v.controls }),
    })),
    ...(d.thumbnail !== undefined && { thumbnail: d.thumbnail }),
    source: "descriptor",
  }));
}

/**
 * Builds the slug-addressable catalog. Ordering matches `createRegistry`. The
 * returned functions do not rely on `this`, so they can be destructured.
 */
export function createCatalog(entries: readonly CatalogEntry[], options: CreateCatalogOptions = {}): Catalog {
  const list = [...entries];
  const categoryOrder = orderCategories(
    list.map((e) => e.category),
    options.categoryOrder,
  );
  const entryBySlug = new Map<string, CatalogEntry>();
  for (const entry of list) {
    if (entryBySlug.has(entry.slug)) {
      throw new Error(`[zudo-sg] createCatalog: duplicate slug ${JSON.stringify(entry.slug)} (id ${JSON.stringify(entry.id)})`);
    }
    entryBySlug.set(entry.slug, entry);
  }

  function getCategoryGroups(): CatalogCategoryGroup[] {
    const byCategory = new Map<string, CatalogEntry[]>();
    for (const entry of list) {
      const bucket = byCategory.get(entry.category) ?? [];
      bucket.push(entry);
      byCategory.set(entry.category, bucket);
    }
    const groups: CatalogCategoryGroup[] = [];
    for (const category of categoryOrder) {
      const stories = byCategory.get(category);
      if (!stories || stories.length === 0) continue;
      stories.sort(compareByOrderThenTitle);
      groups.push({ category, stories });
    }
    return groups;
  }

  return {
    categoryOrder,
    entries: list,
    getStoryBySlug: (slug) => entryBySlug.get(slug),
    getAllSlugs: () => list.map((e) => e.slug),
    getCategoryGroups,
  };
}
