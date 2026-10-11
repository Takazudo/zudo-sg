import { demoUiWindTokens, demoUiWindBreakpoints } from "@zudo-sg/demo-ui/styles/wind-tokens.mjs";
import { defineConfig } from "@takazudo/zfb/config";
import { zudoDocPreset } from "@takazudo/zudo-doc/preset";
import { withZudoSg } from "@takazudo/zudo-sg/config";
import zudoSgConfig from "./zudo-sg.config.mjs";
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
// `bundleZdtp: true` with `designTokenPanel` off (it is `false` in
// settings.ts) is load-bearing, not redundant: bundling otherwise follows
// `bundleZdtp ?? designTokenPanel`, so the zdtp-loader would resolve to the
// throwing stub and the engine's PREVIEW token panel — the one panel this
// site still mounts — would reject at runtime (zudolab/zudo-doc#4261).
const presetSettings = {
  ...settings,
  bundleZdtp: true,
};
const preset = zudoDocPreset({
  settings: presetSettings,
  buildDocsSchema,
  directiveVocabulary,
  translations,
  colorSchemes,
});

export default defineConfig({
  // Pin the dev/preview port — zfb defaults to 3000, but the generated
  // CLAUDE.md and the Tauri dev wrappers assume 4321.
  port: 4321,
  base: settings.base,
  strictContentBridge: true,
  // Retained public zfb guard: reject plain CSS imports that cannot be emitted.
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
  // that separate build outside the root bundle. `doc/` is excluded for the
  // same reason (#649 doc-site split): it is a standalone zudo-doc workspace
  // with its own build/deploy, and root markdown-link resolution no longer
  // registers `doc/src/content/docs` as a link-resolution source.
  bundle: {
    exclude: ["apps/demo/**", "doc/**"],
    mainFields: ["main", "module"],
  },
  // Collections, markdown.features, codeHighlight, resolveMarkdownLinks,
  // stripMdExt, trailingSlash, and the package plugin descriptors (search
  // index, llms.txt, claude-resources) — see node_modules/@takazudo/zudo-doc
  // /dist/preset.d.ts for the full fragment this spreads in.
  ...preset,
  // Styleguide engine (@takazudo/zudo-sg/config, ADR decision 9): appends the
  // engine's routes / preview-css / zdtp-apply-proxy plugin descriptors and
  // one `componentDocs` collection per `componentsRoots` entry (#119: the
  // OPTIONAL co-located component MDX docs rendered on `/components/<slug>`)
  // AFTER the zudo-doc preset's. The engine owns `/components`,
  // `/components/[slug]`, `/components/preview` and `/tokens`; a host `pages/`
  // file with one of those URL shapes would silently shadow the injected route.
  // zfb ≥ 2.18.0 seeds dev islands from these injected routes; the
  // `pages/lib/_zudo-sg-islands.ts` shim is a kept-for-API no-op (ADR finding 4).
  ...withZudoSg(
    {
      collections: preset.collections,
      plugins: [
        ...preset.plugins,
        // Run after the preset's doc-history preBuild so the embedded renderer
        // receives freshly generated metadata without importing node:fs.
        {
          // Keep the Node-only plugin as native ESM. Pointing zfb at TypeScript
          // leaves a .zfb-plugin-bundle-* transpilation artifact beside the source.
          name: "./pages/lib/_doc-history-meta.mjs",
        },
      ],
      wind: {
        reset: "owned-v1",
        tokens: {
          ...demoUiWindTokens,
          colors: {
            ...demoUiWindTokens.colors,
            "bg": "var(--color-bg)",
            "fg": "var(--color-fg)",
            "sel-bg": "var(--color-sel-bg)",
            "sel-fg": "var(--color-sel-fg)",
            "surface": "var(--color-surface)",
            "muted": "var(--color-muted)",
            "accent": "var(--color-accent)",
            "accent-hover": "var(--color-accent-hover)",
            "code-bg": "var(--color-code-bg)",
            "code-fg": "var(--color-code-fg)",
            "success": "var(--color-success)",
            "danger": "var(--color-danger)",
            "warning": "var(--color-warning)",
            "info": "var(--color-info)",
            "overlay": "var(--color-overlay)",
            "image-overlay-bg": "var(--color-image-overlay-bg)",
            "image-overlay-fg": "var(--color-image-overlay-fg)",
            "mermaid-node-bg": "var(--color-mermaid-node-bg)",
            "mermaid-text": "var(--color-mermaid-text)",
            "mermaid-line": "var(--color-mermaid-line)",
            "mermaid-label-bg": "var(--color-mermaid-label-bg)",
            "mermaid-note-bg": "var(--color-mermaid-note-bg)",
            "matched-keyword-bg": "var(--color-matched-keyword-bg)",
            "matched-keyword-fg": "var(--color-matched-keyword-fg)",
            "border": "var(--color-border)",
            "border-strong": "var(--color-border-strong)",
          },
          spacing: {
            ...demoUiWindTokens.spacing,
            "icon-xs": "var(--spacing-icon-xs)",
            "icon-sm": "var(--spacing-icon-sm)",
            "icon-md": "var(--spacing-icon-md)",
            "icon-lg": "var(--spacing-icon-lg)",
            "image-overlay-inset": "var(--spacing-image-overlay-inset)",
          },
          shadows: {
            ...demoUiWindTokens.shadows,
            "lg": "var(--shadow-lg)",
          },
          letterSpacings: {
            ...demoUiWindTokens.letterSpacings,
            "tight": "var(--tracking-tight)",
            "normal": "var(--tracking-normal)",
            "wide": "var(--tracking-wide)",
            "wider": "var(--tracking-wider)",
          },
          lineHeights: {
            ...demoUiWindTokens.lineHeights,
            "snug": "var(--leading-snug)",
          },
          radii: {
            ...demoUiWindTokens.radii,
            "lg": "var(--radius-lg)",
            "default": "var(--radius-DEFAULT)",
            "sm": "var(--radius-sm)",
            "md": "var(--radius-md)",
          },
          zIndices: {
            ...demoUiWindTokens.zIndices,
            "toolbar": "var(--z-index-toolbar)",
            "content": "var(--z-index-content)",
            "local-1": "var(--z-index-local-1)",
            "local-2": "var(--z-index-local-2)",
            "local-3": "var(--z-index-local-3)",
            "sidebar": "var(--z-index-sidebar)",
            "dropdown": "var(--z-index-dropdown)",
            "popover": "var(--z-index-popover)",
            "modal-backdrop": "var(--z-index-modal-backdrop)",
            "modal": "var(--z-index-modal)",
            "toast": "var(--z-index-toast)",
            "tooltip": "var(--z-index-tooltip)",
            "drag": "var(--z-index-drag)",
          },
        },
        // Search results are assembled by the inline script, outside JSX scanning.
        safelist: {
          "search-widget": [
            "-mx-hsp-lg", "border-b", "border-muted", "group", "block",
            "px-hsp-lg", "py-vsp-sm", "focus-visible:outline-2",
            "focus-visible:outline-offset-2", "focus-visible:outline-accent",
            "font-semibold", "text-fg", "group-hover:text-accent",
            "group-hover:underline", "group-focus-visible:underline",
            "mt-vsp-2xs", "text-caption", "text-muted", "leading-relaxed",
            "decoration-muted",
          ],
        },
        breakpoints: demoUiWindBreakpoints,
        strict: true,
        dark: false,
        utilities: { placement: "before-authored" },
        sources: {
          roots: ["pages", "src", "packages/demo-ui/src"],
          classHelpers: ["cx", "cn"],
        },
      },
    },
    {
      ...zudoSgConfig,
      // Preview design-token panel: dev-only same-origin Apply endpoint that
      // persists tweaks into packages/demo-ui/styles/*.css, plus the panel island's
      // host tabs.
      zdtpApplyProxy: {
        routingFile: "./zdtp-panel-routing.json",
        writeRoot: "./packages/demo-ui/styles",
        tabsModule: "./src/config/preview-token-panel-tabs.ts",
      },
    },
  ),
});
