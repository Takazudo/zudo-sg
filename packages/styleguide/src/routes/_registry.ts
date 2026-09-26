// Sole importer of `virtual:zudo-sg-registry` (ADR docs/adr/styleguide-engine.md
// decision 10): builds the host catalog once; every entrypoint imports
// `registry` from here, and the preview wrapper imports `storyRegistry`.
//
// The virtual module has the same three exports in both registry modes, so
// this file never branches on imports — only on `ctx.registryMode`. Descriptor
// validation runs at module evaluation, i.e. during the build.

import { storyDescriptors, storyExportOrder, storyModules } from "virtual:zudo-sg-registry";
import {
  catalogEntriesFromDescriptors,
  catalogEntriesFromRegistry,
  createCatalog,
  createRegistry,
  validateStoryDescriptors,
} from "../registry/index.js";
import { ctx } from "./_context.js";

// The detail-URL slug to reserve is the one the served preview document
// occupies: the host's `externalPreview` URL when set (the in-engine
// `componentsPreview` route is then not injected), else `componentsPreview`.
const collisionRoutes =
  ctx.externalPreviewUrl ? { ...ctx.routes, componentsPreview: ctx.externalPreviewUrl } : ctx.routes;

/** Module-mode StoryModule registry (render closures, for the preview app). Empty in descriptor mode. */
export const storyRegistry = createRegistry(storyModules, {
  categoryOrder: ctx.categoryOrder,
  storyExportOrder,
  routes: collisionRoutes,
});

/** The mode-neutral catalog every route, the nav and search read. */
export const registry =
  ctx.registryMode === "descriptor"
    ? createCatalog(catalogEntriesFromDescriptors(validateStoryDescriptors(storyDescriptors, { routes: collisionRoutes })), {
        categoryOrder: ctx.categoryOrder,
      })
    : createCatalog(catalogEntriesFromRegistry(storyRegistry), { categoryOrder: storyRegistry.categoryOrder });
