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

  // ── Preset-owned fields (content collections, plugins, markdown, …) ────────
  ...zudoDocPreset({ settings, buildDocsSchema, directiveVocabulary, translations, colorSchemes }),
});
