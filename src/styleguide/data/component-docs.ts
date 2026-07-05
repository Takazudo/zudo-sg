// Per-component docs (#119) — the join between a discovered story and its
// OPTIONAL co-located MDX doc file.
//
// A component MAY ship a doc at `packages/ui/src/<name>/<name>.mdx`, next to its
// `<name>.stories.tsx`. That file is a `componentDocs` content-collection entry
// (see zfb.config.ts); the collection is rooted at `packages/ui/src`, so an
// entry's slug is its path relative to that root, minus `.mdx` — e.g.
// `button/button`. The story registry keys off a glob-relative path of the
// shape `./ui/src/<name>/<name>.stories.tsx`, so the doc slug is that same path
// with the `./ui/src/` prefix and `.stories.tsx` suffix stripped.
//
// This is pure string logic (no `zfb/content` import) so it lives in the
// tsc-checked `src/` tree and is unit-testable; the detail page (under the
// tsc-excluded `pages/` tree) feeds the result to `getEntry("componentDocs", …)`.

/** Collection name registered in zfb.config.ts for co-located component docs. */
export const COMPONENT_DOCS_COLLECTION = "componentDocs";

const STORY_PATH_PREFIX = "./ui/src/";
const STORY_PATH_SUFFIX = ".stories.tsx";

/**
 * Derive the `componentDocs` collection slug for a story registry entry's
 * `path`. Returns `null` when the path is not the expected glob-relative story
 * shape (so a caller can skip the doc lookup rather than query a bad slug).
 *
 * @example
 *   componentDocSlug("./ui/src/button/button.stories.tsx") // "button/button"
 */
export function componentDocSlug(storyPath: string): string | null {
  if (
    !storyPath.startsWith(STORY_PATH_PREFIX) ||
    !storyPath.endsWith(STORY_PATH_SUFFIX)
  ) {
    return null;
  }
  const stem = storyPath.slice(
    STORY_PATH_PREFIX.length,
    storyPath.length - STORY_PATH_SUFFIX.length,
  );
  return stem.length > 0 ? stem : null;
}
