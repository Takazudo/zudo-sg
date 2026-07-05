import { defineConfig } from "@takazudo/zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { settings } from "./src/config/settings";
import { buildDocsSchema } from "./src/config/docs-schema";
import { translations } from "./src/config/i18n";
import { colorSchemes } from "./src/config/color-schemes";

// Admonitions recipe: register the :::name directive vocabulary
// (note/tip/info/warning/danger/caution/details) → components.
const directiveVocabulary = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  danger: "Danger",
  caution: "Caution",
  details: "Details", // collapsible — routes to DetailsWrapper
};

// `translations` + `colorSchemes` are only consumed when
// `settings.packageOwnedRoutes` is on (#113): they ride into the
// `virtual:zudo-doc-route-context` module so the package-owned doc/404/versions
// routes render with the host's real UI strings and `--zd-*` palette instead of
// the neutral fallback. The preset warns at build time if either is missing.
const preset = zudoDocPreset({
  settings,
  buildDocsSchema,
  directiveVocabulary,
  translations,
  colorSchemes,
});

export default defineConfig({
  framework: "preact",
  // Pin the dev/preview port — zfb defaults to 3000, but the generated
  // CLAUDE.md and the Tauri dev wrappers assume 4321.
  port: 4321,
  tailwind: { enabled: true },
  base: settings.base,
  // Collections, markdown.features, codeHighlight, resolveMarkdownLinks,
  // stripMdExt, trailingSlash, and the package plugin descriptors (search
  // index, llms.txt, claude-resources) — see node_modules/@takazudo/zudo-doc
  // /dist/preset.d.ts for the full fragment this spreads in.
  ...preset,
  // Per-component docs (#119): an OPTIONAL MDX file co-located with each
  // component (`packages/ui/src/<name>/<name>.mdx`) rendered inline as a
  // section on the host-owned `/components/<slug>` detail page (NOT its own
  // route — nothing maps this collection into `resolveMarkdownLinks.dirs`, so
  // zfb generates no page for it). The collection is rooted at the SAME glob
  // root the #103 story codegen walks (`packages/ui/src/<name>/`), keeping doc
  // discovery co-located with story discovery. `include: ["*/*.mdx"]` scopes it
  // to one-level-deep `.mdx` files, ignoring `.tsx`/`.stories.tsx`/`__tests__`.
  // Slug shape is `<name>/<name>` (path relative to the collection root, minus
  // `.mdx`); the detail page derives it from the story entry's dir.
  collections: [
    ...preset.collections,
    {
      name: "componentDocs",
      path: "packages/ui/src",
      include: ["*/*.mdx"],
    },
  ],
  plugins: [
    ...preset.plugins,
    // Project-specific workaround, not part of the preset — see
    // plugins/copy-public-plugin.mjs for why zfb build needs this.
    {
      name: "./plugins/copy-public-plugin.mjs",
      options: {
        publicDir: "public",
      },
    },
    // Wires the preview design-token panel's Apply button to a same-origin
    // dev-only endpoint that persists tweaks into packages/ui/styles/colors.css
    // — see plugins/zdtp-apply-proxy-plugin.mjs for the full pipeline + scope.
    {
      name: "./plugins/zdtp-apply-proxy-plugin.mjs",
    },
  ],
});
