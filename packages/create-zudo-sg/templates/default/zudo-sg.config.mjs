// zudo-sg.config.mjs — styleguide starter configuration.
//
// `componentsRoots[0].importBase` is a RELATIVE path ("../../ui", from this
// config's registryOut directory `src/styleguide/` back up to the project
// root's `ui/`) rather than a package name: this starter has no installed UI
// provider package, only its own `ui/` corpus, so the generated registry's
// `import * as … from "../../ui/<slug>.stories.tsx"` resolves as a plain
// relative import. `uiPackageName` points at the engine's own `stories`
// subpath (the actual origin of `StoryModule`) since there is no separate
// provider package to attribute stories to.

/** @satisfies {import("@takazudo/zudo-sg/config").ZudoSgComposeOptions} */
export default {
  componentsRoots: [{ dir: "ui", importBase: "../../ui" }],
  registryOut: "./src/styleguide/sg-registry.ts",
  categoryOrder: ["Actions", "Layout"],
  uiPackageName: "@takazudo/zudo-sg/stories",
  barrelIndex: null,
  previewStyles: "./src/styles/preview-entry.css",
  tokens: {
    cssFiles: ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"],
    manifestOut: "./src/styleguide/token-manifest.ts",
  },
};
