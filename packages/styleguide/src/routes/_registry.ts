// Sole importer of `virtual:zudo-sg-registry` (ADR docs/adr/styleguide-engine.md
// decision 10): builds the host registry once; every entrypoint and the preview
// wrapper import `registry` from here.

import { storyExportOrder, storyModules } from "virtual:zudo-sg-registry";
import { createRegistry } from "../registry/index.js";
import { ctx } from "./_context.js";

export const registry = createRegistry(storyModules, {
  categoryOrder: ctx.categoryOrder,
  storyExportOrder,
  routes: ctx.routes,
});
