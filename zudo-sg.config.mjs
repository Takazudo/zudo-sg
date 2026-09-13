// zudo-sg.config.mjs
//
// Host-level config for the `zudo-sg` CLI (`@takazudo/zudo-sg`'s `bin`) —
// `pnpm gen:sg-registry`, `pnpm new:component`, `pnpm gen:token-manifest` and
// their `--check` counterparts all read this file. Plain data only, loaded
// via a bare `import()` (see packages/styleguide/src/cli/config.ts). Shape
// locked by docs/adr/styleguide-engine.md decision 10.

/** @type {import("@takazudo/zudo-sg/cli").ZudoSgConfig} */
export default {
  componentsRoots: [{ dir: "packages/ui/src", importBase: "@zudo-sg/ui/src" }],
  registryOut: "./src/styleguide/sg-registry.ts",
  // Mirrors packages/ui/src/stories/categories.ts's STORY_CATEGORIES — a
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
  uiPackageName: "@zudo-sg/ui",
  barrelIndex: "packages/ui/src/index.ts",
  tokens: {
    cssFiles: ["packages/ui/styles/tokens.css", "packages/ui/styles/colors.css"],
    manifestOut: "./src/config/ui-design-tokens-manifest.ts",
  },
  // Consumed by @takazudo/zudo-sg/plugins/preview-css (zfb.config.ts), not by
  // this CLI. Keep the plugin descriptor's `previewStyles` in sync.
  previewStyles: "./src/styles/preview-entry.css",
};
