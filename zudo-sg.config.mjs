// zudo-sg.config.mjs
//
// Host-level config for the `zudo-sg` CLI (`@takazudo/zudo-sg`'s `bin`) —
// `pnpm gen:sg-registry`, `pnpm new:component`, `pnpm gen:token-manifest` and
// their `--check` counterparts all read this file. Plain data only, loaded
// via a bare `import()` (see packages/styleguide/src/cli/config.ts). Shape
// locked by docs/adr/styleguide-engine.md decision 10.

import { sgRouteOptions } from "./src/styleguide/sg-route-options.mjs";

/** @type {import("@takazudo/zudo-sg/cli").ZudoSgConfig} */
export default {
  routes: sgRouteOptions,
  componentsRoots: [{ dir: "packages/demo-ui/src", importBase: "@zudo-sg/demo-ui/src" }],
  registryOut: "./src/styleguide/sg-registry.ts",
  // Mirrors packages/demo-ui/src/stories/categories.ts's STORY_CATEGORIES — a
  // literal copy, not an import, because this file is plain data read by
  // the CLI before any TS is compiled. Categories not listed here are still
  // valid; they sort in alphabetically after these ones (see
  // registry/registry.ts's computeCategoryOrder).
  categoryOrder: [
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
  ],
  uiPackageName: "@zudo-sg/demo-ui",
  barrelIndex: "packages/demo-ui/src/index.ts",
  tokens: {
    cssFiles: ["packages/demo-ui/styles/tokens.css", "packages/demo-ui/styles/colors.css"],
    manifestOut: "./src/config/ui-design-tokens-manifest.ts",
  },
  // Consumed by @takazudo/zudo-sg/plugins/preview-css via zfb.config.ts's
  // withZudoSg(…, zudoSgConfig), not by this CLI.
  previewStyles: "./src/styles/preview-entry.css",
};
