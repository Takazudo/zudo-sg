# Doc 5.2 deletion ledger

This ledger records the replacement or disabled-feature evidence for every local scaffold file removed during the zudo-doc 5.2 migration. The canonical `pages/docs/[[...slug]].tsx` uses only package and virtual-module entrypoints; no deleted file remains in its import graph.

## Route and chrome glue

| Removed file | Replacement evidence |
| --- | --- |
| `pages/_data.ts` | Collection data and route payloads are supplied by the configured `docs` collection and `virtual:zudo-doc-route-context`. |
| `pages/lib/_chrome.ts` | `@takazudo/zudo-doc/chrome` exports `createChrome`; the canonical catch-all calls it directly. |
| `pages/lib/_route-context.ts` | `@takazudo/zudo-doc/route-context` plus `virtual:zudo-doc-route-context` own route-context construction. |
| `pages/lib/_body-end-islands.tsx` | Package chrome emits the enabled theme/search/router/image/mermaid behavior. AI, history, token panel, sidebar controls, and HTML preview remain disabled. |
| `pages/lib/_details.tsx` | The package MDX/chrome bindings provide the canonical details component. |
| `pages/lib/_doc-page-props.ts` | Package route context builds canonical doc-route entries and props. |
| `pages/lib/_doc-route-entries.ts` | `routeCtx.buildDocRouteEntries()` is called by the canonical catch-all. |
| `pages/lib/_extract-headings.ts` | Package route context and chrome use the package heading extractor with the default hierarchical strategy. |
| `pages/lib/_frontmatter-preview-data.ts` | `frontmatterPreview` is disabled by the `zudoDoc()` default. |
| `pages/lib/_locale-merge.ts` | Package route context uses package i18n defaults; no additional locale is configured. |
| `pages/lib/_nav-source-cache.ts` | Package route context owns nav source resolution and caching. |
| `pages/lib/_nav-source-docs.ts` | `routeCtx.resolveNavSource()` supplies the docs nav source. |
| `pages/lib/_preset-generator.tsx` | No preset-generator feature is configured; the obsolete no-op/SSR placeholder is intentionally absent. |
| `pages/lib/_search-widget.tsx` | Package chrome owns search UI and the search-index plugin remains in the preset's effective plugin list. |

## Local components

| Removed file | Replacement evidence |
| --- | --- |
| `src/components/content/code-group.tsx` | Package MDX defaults expose the package code-group component. |
| `src/components/content/content-admonition.tsx` | Package MDX defaults expose canonical directive admonitions. |
| `src/components/client-router-bootstrap.tsx` | Package chrome emits the router bootstrap when `dynamicPageTransition: true`. |
| `src/components/image-enlarge.tsx` | Package chrome emits image enlargement when `imageEnlarge: true`. |
| `src/components/sidebar-tree.tsx` | Package chrome/sidebar exports own the sidebar tree. |
| `src/components/ai-chat-modal.tsx` | `aiAssistant` remains at the disabled package default. |
| `src/components/desktop-sidebar-toggle.tsx` | `sidebarToggle` remains at the disabled package default. |
| `src/components/doc-history.tsx` | `docHistory` remains at the disabled package default. |
| `src/components/preset-generator.tsx` | No preset-generator feature is configured; the local no-op placeholder had no behavior. |
| `src/components/sidebar-toggle.tsx` | Sidebar toggle/resizer settings remain at their disabled package defaults. |

## Configuration and data defaults

| Removed file | Replacement evidence |
| --- | --- |
| `src/config/settings.ts` | Site-specific choices now live directly in `zfb.config.ts`; all omitted values come from `zudoDoc()` defaults. |
| `src/config/settings-types.ts` | `@takazudo/zudo-doc/config` supplies the typed `ZudoDocConfig` contract. |
| `src/config/docs-schema.ts` | `zudoDoc()` supplies the package `buildDocsSchema` default. |
| `src/config/i18n.ts` | `zudoDoc()` supplies the package translation defaults; no additional locales are configured. |
| `src/config/color-scheme-utils.ts` | Package color-scheme utilities own ramp resolution and CSS variable generation. |
| `src/config/color-schemes.ts` | The local schemes matched the package defaults now supplied by `zudoDoc()`. |
| `src/config/sidebars.ts` | Package route context derives sidebar navigation from content plus `headerNav`. |
| `src/config/frontmatter-preview-defaults.ts` | Frontmatter preview is disabled. |
| `src/config/frontmatter-preview-renderers.tsx` | Frontmatter preview is disabled. |
| `src/config/tag-vocabulary.ts` | Tag vocabulary/governance and tag routes remain disabled. |
| `src/config/tag-vocabulary-types.ts` | Tag vocabulary/governance remain disabled; package config owns their types. |
| `src/config/z-index-tokens.ts` | `@takazudo/zudo-doc/theme.css` ships the unchanged default z-index tiers. |

## Claude-resource implementation

| Removed file | Replacement evidence |
| --- | --- |
| `src/integrations/claude-resources/generate.ts` | The effective `@takazudo/zudo-doc/plugins/claude-resources` descriptor is enabled by `claudeResources` and owns generation. |
| `src/integrations/claude-resources/escape-for-mdx.ts` | Escaping is internal to the package claude-resources plugin. |
| `src/integrations/claude-resources/__tests__/generate.test.ts` | The deleted local generator no longer exists; package tests cover its replacement. Built artifact inventory verifies integration here. |
| `src/integrations/claude-resources/__tests__/escape-for-mdx.test.ts` | The deleted local escape helper no longer exists; package tests cover its replacement. |

## Local structural types and utilities

| Removed file | Replacement evidence |
| --- | --- |
| `src/types/docs-entry.ts` | Package route-context payload and zfb collection types define docs entries. |
| `src/types/heading.ts` | Package heading extraction and route context define heading data. |
| `src/types/locale.ts` | Package settings/route-context types define locale data. |
| `src/utils/base.ts` | Package URL helpers apply `base: "/"`. |
| `src/utils/docs.ts` | Package route context owns collection loading and doc normalization. |
| `src/utils/git-info.ts` | History/metainfo are disabled; no local git lookup is needed. |
| `src/utils/github.ts` | Edit/source links are disabled (`editUrl` and `githubUrl` defaults are false). |
| `src/utils/nav-scope.ts` | Package nav-scope logic consumes configured `headerNav`. |
| `src/utils/sidebar.ts` | Package sidebar/nav-data preparation owns sidebar construction. |
| `src/utils/slug.ts` | Package slug and URL helpers own route slug normalization. |
| `src/utils/smart-break.tsx` | Package chrome/content components own smart-break rendering. |
| `src/utils/tags.ts` | Tags and tag governance remain disabled. |

## Preserved surface

- `pages/index.tsx`: canonical package route re-export.
- `pages/docs/[[...slug]].tsx`: canonical self-contained dynamic docs route.
- `src/content/docs/**/*.mdx`: all 12 authored resources and URLs.
- `src/styles/global.css`: canonical 5.2 stylesheet scaffold.
- `public/favicon.svg`, `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`: canonical neutral favicon set.
