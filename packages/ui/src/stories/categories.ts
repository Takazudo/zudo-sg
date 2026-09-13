/**
 * zudo-sg's own declared story category order — data, not part of the
 * story-authoring contract (`./types.ts`, which stays byte-equivalent with the
 * engine's `@takazudo/zudo-sg/stories` copy). The root host passes this list
 * as `categoryOrder` to the engine registry, and
 * `scripts/lib/component-scaffold.mjs` regex-parses this file's source text
 * (it is a dependency-free .mjs script that can't import TS). Categories not
 * listed here are still valid — they are appended alphabetically.
 */
export const STORY_CATEGORIES = [
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  "Content",
  "Landing",
  "News",
  "Search",
  "Feedback",
  "Media",
] as const;
