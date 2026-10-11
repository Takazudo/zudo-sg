/** @type {import("@takazudo/zudo-sg/config").ZudoSgComposeOptions} */
export default {
  registry: { mode: "descriptor", module: "./src/story-descriptors.ts" },
  externalPreview: { url: "/frame/", runtime: "external-v1" },
  previewStyles: "./src/styles/preview-entry.css",
  tokens: { cssFiles: ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"], manifestOut: "./src/styleguide/token-manifest.ts" },
  zdtpApplyProxy: { tabsModule: "./src/config/preview-token-panel-tabs.ts" },
};
