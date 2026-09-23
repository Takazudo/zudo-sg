import base from "./zudo-sg.default.config.mjs";

/** @satisfies {import("@takazudo/zudo-sg/config").ZudoSgComposeOptions} */
export default {
  ...base,
  tokens: {
    cssFiles: ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"],
    manifestOut: "./src/styleguide/token-manifest.ts",
    spec: {
      palette: [
        { id: "brand", label: "Brand", tokens: [{ cssVar: "--brand-100", id: "pale-brand", label: "Brand pale" }, { cssVar: "--brand-500", readonly: true }] },
        { id: "signals", label: "Signals", tokens: [{ cssVar: "--signal-calm" }, { cssVar: "--status-alert" }] },
      ],
      color: [{ id: "surface", label: "Surfaces", tokens: [{ cssVar: "--surface-canvas", control: "text", note: "Mode-aware surface" }] }],
      spacing: [{ id: "inset", label: "Inset", preview: "bar", tokens: [{ cssVar: "--space-inline", step: 0.125, unit: "rem", units: ["rem", "px"] }] }],
      font: [
        { id: "type-size", label: "Type size", preview: "size", tokens: [{ cssVar: "--type-body", step: 0.125, unit: "rem" }] },
        { id: "leading", label: "Leading", preview: "line-height", previewBase: "--type-body", tokens: [{ cssVar: "--type-leading", valueKind: "number", step: 0.1 }] },
        { id: "weight", label: "Weight", preview: "weight", tokens: [{ cssVar: "--type-weight", control: "select", options: ["350", "550", "750"] }] },
      ],
      size: [{ id: "corners", label: "Corners", preview: "radius", tokens: [{ cssVar: "--corner-card", step: 0.125, unit: "rem" }] }],
    },
  },
};
