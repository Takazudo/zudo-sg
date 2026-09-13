/**
 * zudo-sg's own declared story category order — data, not part of the
 * story-authoring contract (`./types.ts`, which stays byte-equivalent with the
 * engine's `@takazudo/zudo-sg/stories` copy). The root host passes this list
 * as `categoryOrder` to the engine registry, and
 * `zudo-sg.config.mjs`'s `categoryOrder` field keeps a literal copy of this
 * list for the `zudo-sg` CLI's `new-component` scaffolder (a plain-data
 * config file can't import TS — see packages/styleguide/src/cli/config.ts).
 * Categories not listed here are still valid — they are appended
 * alphabetically.
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
