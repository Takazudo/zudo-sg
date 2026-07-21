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
  // preview-demos/contact-form-demo.tsx, #235 — retargeted from the retired
  // dialog-demo.tsx). This is zfb's own documented escape hatch
  // for exactly this case — see the `msw` → `path-to-regexp@6` example in
  // node_modules/@takazudo/zfb's BundleConfig.mainFields doc (zfb #676).
  // `bundle.external: ["path-to-regexp"]` would scope this narrower, but
  // mainFields is zfb's *documented* fix for this msw case (#676), so we use it.
  //
  // zudo-doc 4.x's html-preview-wrapper and doc-history-area package modules
  // reference two of @takazudo/zudo-doc's OPTIONAL peer deps —
  // `@takazudo/zfb-md-wasm` (lazy-loaded for the HtmlPreview source panel)
  // and `@takazudo/zudo-doc-history-server` (imported eagerly at module top
  // level, unconditionally — not gated by the `docHistory` setting this
  // project has off, see settings.ts) — regardless of whether the owning
  // feature is enabled. `bundle.external` (zfb's documented escape hatch,
  // BundleConfig.external) resolved this for the main SSR/page bundle pass,
  // but NOT for the separate islands production bundle pass or zfb's
  // static-paths evaluation (an embedded runtime that can't fall back to
  // Node's module resolution the way a browser/SSR bundle can) — both still
  // failed to resolve the bare specifiers. Installing both as real
  // dependencies (see package.json) fixes every pass uniformly; neither is
  // reached at runtime since both owning features are off.
  bundle: { mainFields: ["main", "module"] },
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
  // root the #103/#224 story codegen walks (`packages/ui/src/**/`), keeping
  // doc discovery co-located with story discovery at ANY depth — both the old
  // one-level layout (`<name>/<name>.mdx`) and the new category-nested layout
  // (`<category>/<name>/<name>.mdx`). `include: ["**/*.mdx"]` uses the
  // globset dialect's `**` (matches zero or more directory components), so it
  // covers both depths in one pattern while still ignoring `.tsx`/
  // `.stories.tsx`/`__tests__`. Slug shape is the path relative to the
  // collection root minus `.mdx` (e.g. `button/button` or
  // `layout/badge-icon/badge-icon`); the detail page derives it from the
  // story entry's dir (component-docs.ts's `componentDocSlug`, which is
  // depth-agnostic string-prefix/suffix stripping — no change needed there).
  collections: [
    ...preset.collections,
    {
      name: "componentDocs",
      path: "packages/ui/src",
      include: ["**/*.mdx"],
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
    // Dev-only capability-gated transport for canonical Composer records and
    // their browser-generated JSX. Build/preview receive an undefined virtual
    // config and never install the middleware hook.
    {
      name: "./plugins/composer-file-provider-plugin.mjs",
    },
  ],
});
