// zudo-sg.config.mjs — styleguide starter configuration.
//
// `componentsRoots[0].importBase` is a RELATIVE path ("../../ui", from this
// config's registryOut directory `src/styleguide/` back up to the project
// root's `ui/`) rather than a package name: this starter has no installed UI
// provider package, only its own `ui/` corpus, so the generated registry's
// `import * as … from "../../ui/<slug>.stories.tsx"` resolves as a plain
// relative import. This host has no separate provider package, so it omits
// `uiPackageName`; generated usage snippets use each component's own relative
// module path instead.

/** @satisfies {import("@takazudo/zudo-sg/config").ZudoSgComposeOptions} */
export default {
  componentsRoots: [{ dir: "ui", importBase: "../../ui" }],
  registryOut: "./src/styleguide/sg-registry.ts",
  categoryOrder: ["Actions", "Layout"],
  barrelIndex: null,
  previewStyles: "./src/styles/preview-entry.css",
  tokens: {
    cssFiles: ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"],
    manifestOut: "./src/styleguide/token-manifest.ts",
  },
  // Tabs-only shape (routingFile/writeRoot omitted): the header trigger's
  // preview token panel gets the manifest-derived tabs, but no dev-only Apply
  // write sandbox — a fresh scaffold has no sensible default path for one.
  // Wiring the Apply sandbox is an opt-in next step (#818).
  zdtpApplyProxy: {
    tabsModule: "./src/config/preview-token-panel-tabs.ts",
  },
};
