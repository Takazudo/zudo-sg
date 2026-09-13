// The root host's registry instance: the engine's pure data layer
// (`@takazudo/zudo-sg/registry`) fed with this site's generated story map and
// its declared category order. Built once at module init (eager + synchronous).

import { createRegistry } from "@takazudo/zudo-sg/registry";
import { STORY_CATEGORIES } from "@zudo-sg/demo-ui";
import { storyExportOrder, storyModules } from "./sg-registry";

export { OVERVIEW_SLUG, TOKENS_SLUG } from "@takazudo/zudo-sg/registry";
export type { CategoryGroup, StoryEntry, VariantEntry } from "@takazudo/zudo-sg/registry";

export const registry = createRegistry(storyModules, {
  categoryOrder: STORY_CATEGORIES,
  storyExportOrder,
});

export const {
  categoryOrder: CATEGORY_ORDER,
  storyEntries,
  getStoryBySlug,
  getAllSlugs,
  getCategoryGroups,
} = registry;
