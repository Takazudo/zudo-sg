// Per-component docs (#119, multi-root #670) — the join between a discovered
// story and its OPTIONAL co-located MDX doc file.
//
// A component MAY ship a doc at `<componentsRoot.dir>/<rel>/<name>.mdx`, next to
// its `<name>.stories.tsx`. `zudoSg()` registers one content collection per
// components root, rooted at that root's `dir`, so an entry's slug is its path
// relative to the root, minus `.mdx` — e.g. `button/button`. The story registry
// keys each module `./<keyPrefix>/<rel>/<name>.stories.tsx`, where `keyPrefix`
// is `deriveMapKeyPrefix(dir)`; the doc slug is that key with the root's
// `./<keyPrefix>/` prefix and `.stories.tsx` suffix stripped.
//
// Pure string logic (no `node:` or `zfb/content` import): the config module
// (node-free) and the detail route both import it, and it is unit-testable.

/** Collection name of `componentsRoots[0]`; later roots append their index. */
export const COMPONENT_DOCS_COLLECTION = "componentDocs";

const STORY_PATH_SUFFIX = ".stories.tsx";

/** One components root's registry key prefix and its docs collection — `sgContext.componentDocs[i]`. */
export interface ComponentDocsRoot {
  /** `storyModules` key prefix without `./` or a trailing slash, e.g. `"ui/src"`. */
  keyPrefix: string;
  /** Content collection holding this root's MDX docs, e.g. `"componentDocs"`. */
  collection: string;
}

/** A resolved doc lookup: `getEntry(collection, slug)`. */
export interface ComponentDocRef {
  collection: string;
  slug: string;
}

/**
 * `packages/demo-ui/src` → `ui/src` — the `storyModules` map key prefix for a
 * components root. Strips a leading `./`, a leading `packages/` segment (the
 * repo's workspace-package convention) and trailing slashes; a root outside
 * `packages/` keys off its project-root-relative dir verbatim.
 */
export function deriveMapKeyPrefix(dir: string): string {
  return dir.replace(/^(\.\/)+/, "").replace(/^packages\//, "").replace(/\/+$/, "");
}

/** Collection name for `componentsRoots[index]`. */
export function componentDocsCollectionName(index: number): string {
  return index === 0 ? COMPONENT_DOCS_COLLECTION : `${COMPONENT_DOCS_COLLECTION}${index}`;
}

/** The `sgContext.componentDocs` list for a `componentsRoots` array (same order as the collections). */
export function componentDocsRoots(roots: ReadonlyArray<{ dir: string }>): ComponentDocsRoot[] {
  return roots.map((root, i) => ({
    keyPrefix: deriveMapKeyPrefix(root.dir),
    collection: componentDocsCollectionName(i),
  }));
}

/**
 * Resolve the doc collection + slug for a story registry entry's `path`, from
 * the components root its key belongs to (longest matching prefix wins, so a
 * nested root is never shadowed by its parent). Returns `null` when no root
 * matches or the path is not the story key shape.
 *
 * @example
 *   resolveComponentDoc("./ui/src/button/button.stories.tsx", [{ keyPrefix: "ui/src", collection: "componentDocs" }])
 *   // { collection: "componentDocs", slug: "button/button" }
 */
export function resolveComponentDoc(
  storyPath: string,
  roots: ReadonlyArray<ComponentDocsRoot>,
): ComponentDocRef | null {
  if (!storyPath.endsWith(STORY_PATH_SUFFIX)) return null;
  let best: { root: ComponentDocsRoot; prefix: string } | null = null;
  for (const root of roots) {
    const prefix = `./${root.keyPrefix}/`;
    if (storyPath.startsWith(prefix) && (best === null || prefix.length > best.prefix.length)) {
      best = { root, prefix };
    }
  }
  if (best === null) return null;
  const slug = storyPath.slice(best.prefix.length, storyPath.length - STORY_PATH_SUFFIX.length);
  return slug.length > 0 ? { collection: best.root.collection, slug } : null;
}
