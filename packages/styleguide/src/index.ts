// @takazudo/zudo-sg — root entry. Feature code lives behind subpath exports
// (`@takazudo/zudo-sg/registry`, `/stories`, `/host-paths`, `/sg-routes`, …);
// this barrel re-exports only the small, dependency-free core so importing
// the root never drags in Node-only or client-only modules.

export {
  createRegistry,
  buildNavNodes,
  OVERVIEW_SLUG,
  TOKENS_SLUG,
} from "./registry/index.js";
export type {
  CategoryGroup,
  NavNode,
  Registry,
  StoryEntry,
  VariantEntry,
} from "./registry/index.js";
export { defineStory } from "./stories/index.js";
export type { Story, StoryControl, StoryMeta, StoryModule } from "./stories/index.js";
export { DEFAULT_SG_ROUTES, resolveSgRoutes, componentHref } from "./sg-routes.js";
export type { SgRoutes } from "./sg-routes.js";
