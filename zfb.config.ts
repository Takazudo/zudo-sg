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
//
// `designTokenPanel: false` here (NOT `settings.designTokenPanel`, which stays
// `true` for the host's own header icon / BodyEndIslands wiring) is a narrow
// preset-only override. It prevents package-owned routes from also mounting
// zudo-doc's panel while the host keeps its two project-specific instances.
//
// Hoisted to a `const` (not inlined) so TypeScript infers its type
// structurally instead of checking it as a fresh object literal against
// `PresetSettings` — which doesn't declare `designTokenPanel` at all (it's
// read off the wider runtime settings shape, not this narrower preset-facing
// type), so an inline literal here would fail excess-property checking.
const presetSettings = { ...settings, designTokenPanel: false };
const preset = zudoDocPreset({
  settings: presetSettings,
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
  strictContentBridge: true,
  // zfb 2.14 guard: fail builds when JS/TS imports plain CSS bytes it cannot emit.
  strictPlainCssImports: true,
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
  // zfb treats apps/ as an extra source root and recursively runs root markdown
  // processing over demo MDX; apps/demo owns its own config/public tree, so keep
  // that separate build outside the root bundle.
  bundle: {
    exclude: ["apps/demo/**"],
    mainFields: ["main", "module"],
  },
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
    // Wires the preview design-token panel's Apply button to a same-origin
    // dev-only endpoint that persists tweaks into packages/ui/styles/colors.css
    // — see plugins/zdtp-apply-proxy-plugin.mjs for the full pipeline + scope.
    {
      name: "./plugins/zdtp-apply-proxy-plugin.mjs",
    },
  ],
});
