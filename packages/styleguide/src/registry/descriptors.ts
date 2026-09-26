// Descriptor-mode story metadata (epic #879, E1). A host whose stories cannot
// be handed to the engine as StoryModules (e.g. React function exports) gives
// plain, serializable metadata instead. This module defines that shape and
// validates it at build time; it never renders anything.

import type { StoryControl } from "../stories/types.js";
import { previewCollisionSlug, type SgRoutes } from "../sg-routes.js";
import { RESERVED_NAV_SLUGS } from "./registry.js";

/** One variant of a descriptor story. `exportName` is the stable preview-URL id. */
export interface VariantDescriptor {
  exportName: string;
  name: string;
  controls?: StoryControl[];
}

/** A pre-captured catalog tile image, or a labelled placeholder note. */
export type ThumbnailDescriptor =
  | { kind: "image"; src: string; width: number; height: number; alt?: string }
  | { kind: "placeholder"; note: string };

/** Plain-data description of one story. No functions allowed. */
export interface StoryDescriptor {
  /** Host-stable identity. Unique. */
  id: string;
  /** URL slug, honored verbatim (never re-slugified from `title`). Unique and URL-safe. */
  slug: string;
  category: string;
  title: string;
  description?: string;
  /** Source file path, informational only. */
  sourcePath?: string;
  /** Ordering hint within the category (lower = earlier). */
  order?: number;
  variants: VariantDescriptor[];
  thumbnail?: ThumbnailDescriptor;
}

export interface ValidateStoryDescriptorsOptions {
  /** The same route overrides passed to `withZudoSg()`; used to reject a slug the preview endpoint occupies. */
  routes?: Partial<SgRoutes>;
}

// A slug becomes one path segment of the detail URL.
const UNSAFE_SLUG = /[\s/\\?#%]/;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function describeEntry(index: number, raw: unknown): string {
  const id = isRecord(raw) && typeof raw.id === "string" && raw.id !== "" ? JSON.stringify(raw.id) : "(missing)";
  return `storyDescriptors[${index}] (id ${id})`;
}

/** Dotted path of the first function found inside `value`, or null. */
function findFunction(value: unknown, path: string, seen: Set<unknown>): string | null {
  if (typeof value === "function") return path;
  if (typeof value !== "object" || value === null || seen.has(value)) return null;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const found = findFunction(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
    if (found) return found;
  }
  return null;
}

function validateThumbnail(value: unknown): string | null {
  if (!isRecord(value)) return "thumbnail must be an object";
  if (value.kind === "image") {
    if (!isNonEmptyString(value.src)) return 'image thumbnail needs a non-empty "src"';
    for (const dim of ["width", "height"] as const) {
      const n = value[dim];
      if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
        return `image thumbnail needs a positive finite "${dim}"`;
      }
    }
    if (value.alt !== undefined && typeof value.alt !== "string") return 'image thumbnail "alt" must be a string';
    return null;
  }
  if (value.kind === "placeholder") {
    return isNonEmptyString(value.note) ? null : 'placeholder thumbnail needs a non-empty "note"';
  }
  return `thumbnail.kind must be "image" or "placeholder" (got ${JSON.stringify(value.kind)})`;
}

function validateControls(value: unknown): string | null {
  if (!Array.isArray(value)) return "controls must be an array";
  for (const [i, control] of value.entries()) {
    if (!isRecord(control) || !isNonEmptyString(control.type) || !isNonEmptyString(control.prop)) {
      return `controls[${i}] needs string "type" and "prop"`;
    }
  }
  return null;
}

function copyThumbnail(t: ThumbnailDescriptor): ThumbnailDescriptor {
  if (t.kind === "placeholder") return { kind: "placeholder", note: t.note };
  return {
    kind: "image",
    src: t.src,
    width: t.width,
    height: t.height,
    ...(t.alt !== undefined && { alt: t.alt }),
  };
}

/**
 * Validates host-supplied story descriptors and returns normalized copies
 * (unknown keys dropped). Throws a `[zudo-sg]` error naming the offending
 * entry's index and id. Slugs are kept verbatim; reserved nav slugs and the
 * slug the preview endpoint occupies are rejected rather than auto-suffixed.
 */
export function validateStoryDescriptors(
  input: unknown,
  options: ValidateStoryDescriptorsOptions = {},
): StoryDescriptor[] {
  if (!Array.isArray(input)) {
    throw new Error(
      `[zudo-sg] storyDescriptors must be an array of story descriptors (got ${input === null ? "null" : typeof input})`,
    );
  }

  const reserved = new Set(RESERVED_NAV_SLUGS);
  const previewSlug = previewCollisionSlug(options.routes);
  if (previewSlug !== null) reserved.add(previewSlug);

  const idIndex = new Map<string, number>();
  const slugIndex = new Map<string, number>();
  const result: StoryDescriptor[] = [];

  input.forEach((raw: unknown, index) => {
    const where = describeEntry(index, raw);
    const fail = (problem: string): never => {
      throw new Error(`[zudo-sg] ${where}: ${problem}`);
    };

    if (!isRecord(raw)) fail("must be an object");
    const entry = raw as Rec;

    const fn = findFunction(entry, "descriptor", new Set());
    if (fn) fail(`${fn} is a function; descriptors must be plain data`);

    for (const key of ["id", "slug", "title", "category"] as const) {
      if (!isNonEmptyString(entry[key])) fail(`"${key}" must be a non-empty string`);
    }
    const id = entry.id as string;
    const slug = entry.slug as string;

    if (UNSAFE_SLUG.test(slug) || slug === "." || slug === "..") {
      fail(`slug ${JSON.stringify(slug)} is not URL-safe (no "/", "\\", "?", "#", "%" or whitespace)`);
    }
    if (reserved.has(slug)) {
      fail(`slug ${JSON.stringify(slug)} is reserved by the styleguide routes`);
    }

    const prevId = idIndex.get(id);
    if (prevId !== undefined) fail(`duplicate id ${JSON.stringify(id)} (also used by storyDescriptors[${prevId}])`);
    idIndex.set(id, index);
    const prevSlug = slugIndex.get(slug);
    if (prevSlug !== undefined) {
      fail(`duplicate slug ${JSON.stringify(slug)} (also used by storyDescriptors[${prevSlug}])`);
    }
    slugIndex.set(slug, index);

    for (const key of ["description", "sourcePath"] as const) {
      if (entry[key] !== undefined && typeof entry[key] !== "string") fail(`"${key}" must be a string`);
    }
    if (entry.order !== undefined && (typeof entry.order !== "number" || !Number.isFinite(entry.order))) {
      fail('"order" must be a finite number');
    }

    if (!Array.isArray(entry.variants) || entry.variants.length === 0) {
      fail('"variants" must be a non-empty array');
    }
    const exportNames = new Set<string>();
    const variants: VariantDescriptor[] = (entry.variants as unknown[]).map((v, vi) => {
      const at = `variants[${vi}]`;
      if (!isRecord(v)) return fail(`${at} must be an object`);
      if (!isNonEmptyString(v.exportName)) return fail(`${at}.exportName must be a non-empty string`);
      if (exportNames.has(v.exportName)) return fail(`${at}: duplicate exportName ${JSON.stringify(v.exportName)}`);
      exportNames.add(v.exportName);
      if (!isNonEmptyString(v.name)) return fail(`${at}.name must be a non-empty string`);
      if (v.controls !== undefined) {
        const problem = validateControls(v.controls);
        if (problem) return fail(`${at}.${problem}`);
      }
      return {
        exportName: v.exportName,
        name: v.name,
        ...(v.controls !== undefined && { controls: v.controls as StoryControl[] }),
      };
    });

    if (entry.thumbnail !== undefined) {
      const problem = validateThumbnail(entry.thumbnail);
      if (problem) fail(`malformed thumbnail: ${problem}`);
    }

    result.push({
      id,
      slug,
      category: entry.category as string,
      title: entry.title as string,
      ...(entry.description !== undefined && { description: entry.description as string }),
      ...(entry.sourcePath !== undefined && { sourcePath: entry.sourcePath as string }),
      ...(entry.order !== undefined && { order: entry.order as number }),
      variants,
      ...(entry.thumbnail !== undefined && { thumbnail: copyThumbnail(entry.thumbnail as ThumbnailDescriptor) }),
    });
  });

  return result;
}
