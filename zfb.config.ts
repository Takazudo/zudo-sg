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
const resolveMarkdownLinks = preset.resolveMarkdownLinks
  ? {
      ...preset.resolveMarkdownLinks,
      // The root build runs from the monorepo root and zfb validates workspace
      // MDX files it sees. Register the standalone doc workspace as a link
      // resolution source so its required relative .mdx links do not warn
      // during the root styleguide build. This only affects markdown-link
      // validation/rewrite; the root site's page routes still come from the
      // root `docs` collection below.
      dirs: [
        ...preset.resolveMarkdownLinks.dirs,
        { dir: "doc/src/content/docs", routePrefix: "/docs/" },
      ],
    }
  : preset.resolveMarkdownLinks;

export default defineConfig({
  framework: "preact",
  // Pin the dev/preview port — zfb defaults to 3000, but the generated
  // CLAUDE.md and the Tauri dev wrappers assume 4321.
  port: 4321,
  tailwind: { enabled: true },
  base: settings.base,
  // #215: msw's core resolves through path-to-regexp@6, a CJS-main/module-only
  // package (no `exports` map). esbuild's `--platform=neutral` page/SSR pass
  // (used for the client island bundle) has an EMPTY main-fields list by
  // default, so it rejects that dependency ("Main fields must be configured
  // explicitly when using the neutral platform") the moment any island
  // transitively imports `msw`/`msw/browser` (src/features/styleguide/
  // preview-demos/dialog-demo.tsx). This is zfb's own documented escape hatch
  // for exactly this case — see the `msw` → `path-to-regexp@6` example in
  // node_modules/@takazudo/zfb's BundleConfig.mainFields doc (zfb #676).
  bundle: { mainFields: ["main", "module"] },
  // Collections, markdown.features, codeHighlight, resolveMarkdownLinks,
  // stripMdExt, trailingSlash, and the package plugin descriptors (search
  // index, llms.txt, claude-resources) — see node_modules/@takazudo/zudo-doc
  // /dist/preset.d.ts for the full fragment this spreads in.
  ...preset,
  // Override the preset's syntect code theme (base16-ocean.light/.dark) with
  // WCAG-AA-compliant variants (#169 / supersedes #133). The stock base16-ocean
  // palette fails AA for normal text: in light mode every accent hue plus the
  // comment grey is <4.5:1 on its #eff1f5 background (only the #4f5b66
  // default-text grey passes); in dark mode the comment, red, and brown hues
  // fail on #2b303b. Token colors are baked per-span inline by syntect at build
  // time, so they can't be remapped in CSS — the only fix is at the theme level.
  // These two themes are base16-ocean with ONLY the sub-AA token hues nudged
  // (hue preserved) to >=4.5:1 against each theme's own background; backgrounds
  // and default text are unchanged. See src/styles/syntect-themes/*.tmTheme; the
  // AA invariant is guarded by scripts/__tests__/syntect-theme-contrast.test.ts.
  // Referenced by each theme's internal `name`, not filename.
  codeHighlight: {
    themesDir: "src/styles/syntect-themes",
    themeLight: "Base16 Ocean Light A11y",
    themeDark: "Base16 Ocean Dark A11y",
  },
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
  resolveMarkdownLinks,
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
