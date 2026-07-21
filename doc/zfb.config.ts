import { defineConfig } from "zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { settings } from "./src/config/settings";
import { buildDocsSchema } from "./src/config/docs-schema";
import { translations } from "./src/config/i18n";
import { colorSchemes } from "./src/config/color-schemes";

const directiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details",
};

export default defineConfig({
  // ── Host-owned shell fields ──────────────────────────────────────────────
  framework: "preact",
  // Pin the doc dev/preview port so it does not collide with the app server.
  port: 4323,
  tailwind: { enabled: true },
  // Public URL prefix for <link rel="stylesheet"> and <script> tags.
  base: settings.base,
  // `@takazudo/zfb-md-wasm` and `@takazudo/zudo-doc-history-server` are
  // OPTIONAL peer deps of @takazudo/zudo-doc that its html-preview-wrapper
  // and doc-history-area package modules reach at build time regardless of
  // whether the owning feature (htmlPreview / docHistory) is enabled — both
  // are off here (see settings.ts). Both are real (installed) dependencies
  // instead of `bundle.external`; see the equivalent comment in the root
  // project's zfb.config.ts for why `external` alone doesn't cover every
  // build pass zfb runs (islands bundle, static-paths evaluation).

  // ── Preset-owned fields (content collections, plugins, markdown, …) ────────
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes }),
});
