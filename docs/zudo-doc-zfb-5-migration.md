# zudo-doc 5.2 / zfb 2.2 migration contract

Status: locked for epic [#385](https://github.com/Takazudo/zudo-sg/issues/385) by [#386](https://github.com/Takazudo/zudo-sg/issues/386), 2026-08-08.

This document is the source of truth for the migration from `@takazudo/zudo-doc` 4.3.0 and the `@takazudo/zfb*` `0.1.0-next.89` family. Downstream work must preserve the inventories and ownership boundaries below. A downstream discovery may tighten an acceptance check, but changing a `keep`/`adapt`/`replace`/`delete` decision requires updating this document first.

## Locked versions and evidence

| Package | Before | Target | Contract |
| --- | --- | --- | --- |
| `@takazudo/zudo-doc` | `4.3.0` | `5.2.1` | Exact direct dependency in root and `doc/`. |
| `@takazudo/zfb`, `@takazudo/zfb-runtime` | `0.1.0-next.89` | `2.2.0` | Exact and in lockstep wherever currently consumed. |
| `@takazudo/zfb-adapter-cloudflare` | `0.1.0-next.89` in root/doc manifests but unreachable | absent | Delete from root and `doc/`: all three sites deploy as Workers Static Assets with no `prerender = false`, adapter config, Worker entrypoint, or `nodejs_compat`. Do not add it to the demo. If SSR is added later, adopt the then-current compatible adapter as a separate change. |
| `@takazudo/zfb-md-wasm` | `0.1.0-next.89` | `2.2.0` | Exact in root, `doc/`, and `packages/ui`; it remains reachable from zudo-doc chrome and from ProseMd. |
| `@takazudo/zudo-design-token-lint` | `^1.0.0` | `2.0.0` | Exact root dev dependency. |
| `@takazudo/zudo-doc-history-server` | `^4.3.0` | absent | Delete from root and `doc/`: `docHistory` is off, and 5.2.1 removed the unconditional reachability defect. |
| `@takazudo/zdtp` | `0.4.9` in root | `0.4.9` | Keep root exact; add exact direct dependency to `doc/` because the package bootstrap import remains build-resolved even with the panel off. |

The locked upstream commits are zudo-doc `v4.3.0` `6415c1f377ad7566f09222e9fb5decd17f70fabd` → `v5.2.1` `c1ff668d7785867d746e1ddf5d0e56a1fa64338d`, and zfb `v0.1.0-next.89` `edbb2383a26bcab5ac49c806090625cff7404227` → `v2.2.0` `6b091b75742e395f597726c5fb0dedb8c63d34ad`.

Primary evidence:

- [zudo-doc 5.2.1 changelog](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/CHANGELOG.md) records the 5.0 breaking contract, 5.1 wrap persistence, 5.2 token-panel lazy loading, and the 5.2.1 release.
- [zudo-doc 5.2.1 package contract](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/package.json) pins the zfb `^2.2.0` peers and marks the feature peers optional.
- [zudo-doc optional-peer reachability guard](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/src/__tests__/optional-peer-reachability.test.ts) proves history-server is no longer reachable while `diff`, zdtp, KaTeX, and md-wasm remain accepted reachability.
- [zudo-doc single-entry config](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/src/config.ts) documents `zudoDoc()`, shallow settings merge, `strictContentBridge`, and rejection of removed settings.
- [zudo-doc target config](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/src/__tests__/fixtures/target-manifest/zfb.config.ts), [doc route stub](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/create-zudo-doc/templates/base/pages/docs/%5B%5B...slug%5D%5D.tsx), and [config shim](https://github.com/zudolab/zudo-doc/blob/v5.2.1/packages/zudo-doc/zfb-config-shim.d.ts) define the minimal scaffold and the one still-required dynamic route stub.
- [zfb 2.0.0 release](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/docs/src/content/docs/changelog/v2.0.0.mdx) removes `githubAutolinks` and adds `strictContentBridge`; [2.2.0](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/docs/src/content/docs/changelog/v2.2.0.mdx) is additive over that contract.
- [zfb routing](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/docs/src/content/docs/concepts/routing.mdx) makes `_` the privacy marker and treats ordinary `.ts`/`.js` helpers under `pages/` as routes.
- [zfb static assets](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/docs/src/content/docs/concepts/static-assets.mdx) guarantees native `public/` serving/copying and defines `copyPublicWithBase` behavior.
- [zfb 2.2 config types](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/packages/zfb/src/config.ts) are authoritative for shell fields including `strictContentBridge`, `publicDir`, and `copyPublicWithBase`.
- [zfb-md-wasm 2.2 browser API](https://github.com/Takazudo/zudo-front-builder/blob/v2.2.0/crates/zfb-md-wasm/npm/README.md) remains the authority for browser initialization, rendering, highlighting, diagnostics, and WASM asset delivery.

The source tags and npm manifests agreed on 2026-08-08. No newer release replaces these targets merely because it exists: changing them requires compatibility evidence and a matrix revision.

## Before inventories

These are acceptance baselines, not approximate examples. Counts are the successful isolated latest-stack build evidence recorded in #385; lists explain the ownership behind the counts.

### Root

- Route count: **86** after the two helpers are private. The surface consists of 72 generated `/components/:slug` story details; eight host routes (`/`, `/components`, `/components/preview`, `/components/tokens`, `/composer`, `/composer/preview`, `/docs/versions`, `/preview/contact`); three docs entries (`/docs/guide`, `/docs/guide/composer-persistence`, `/docs/guide/token-panels`); and three always-injected package routes (`/404`, `/sitemap.xml`, `/robots.txt`). The llms plugin emits an additional artifact, not one of those 86 routes. `pages/lib/doc-page-props.ts` and `pages/lib/locale-merge.ts` are accidental failing `/lib/*` route candidates until renamed.
- Configured collections: zudo-doc `docs` plus root `componentDocs` at `packages/ui/src/**/*.mdx`.
- Effective plugin order: zudo-doc routes, search-index, theme-packs, llms-txt; then local copy-public, zdtp Apply proxy, and Composer file provider. Disabled settings do not add claude-resources, doc-history, or changelog.
- Public assets: `public/favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico`, `favicon.svg`, `img/logo.svg`, and `mockServiceWorker.js`, currently copied by the local plugin.
- Required island families: package chrome (`ThemeToggle`, `SidebarToggle`, `SidebarTree`, client router, image/mermaid enlargement); root body-end `DocTokenPanelBootstrap` and `PreviewTokenPanelBootstrap`; styleguide `CatalogFilter`, `VariantFrame`, `PreviewApp`, `TokenPlayground`, `CodePanel`, `SgHeaderToggles`; Composer `ComposerApp` and `ComposerPreviewApp`; preview/contact `ContactFormDemo`. The static import chain from host pages through `pages/lib/_body-end-islands.tsx` and `pages/lib/_chrome-bindings.tsx` is load-bearing for package-injected routes.
- Representative renders to snapshot before and compare after: `/`, `/docs/guide`, `/docs/versions`, `/components`, one `/components/:slug`, `/components/preview?slug=...`, `/components/tokens`, `/composer`, `/composer/preview`, `/404`, `/sitemap.xml`, and `/robots.txt`; inspect `/llms.txt` separately as plugin output.

### `doc/`

- Successful-build output count: **22** after helper privacy. The URL route core is the host `/`, 12 docs entries under `/docs/{getting-started,architecture,development}/...`, and the package `/404`, `/sitemap.xml`, and `/robots.txt`; llms and claude-resources contribute generated artifacts to the observed output set and must be inventoried separately by path. `doc/pages/lib/doc-page-props.ts` and `locale-merge.ts` are accidental failing `/lib/*` route candidates until renamed.
- Configured collection: `docs` at `src/content/docs` (12 MDX entries); no locales, versions, tags, changelogs, or history collections.
- Effective plugin order: zudo-doc routes, claude-resources, search-index, theme-packs, and llms-txt. There are no local plugins.
- Public assets: none before migration.
- Required island families: package theme/search/router/image/mermaid behavior plus the current host `ClientRouterBootstrap`; disabled AI, history, token-panel, sidebar toggle/resizer, and HTML preview must not gain markers.
- Representative renders: `/`, `/docs/getting-started`, `/docs/architecture/design-tokens`, `/docs/development/quality-gates`, `/404`, `/sitemap.xml`, and `/robots.txt`; inspect `/llms.txt` and one generated claude-resource artifact separately.

### `apps/demo`

- Route count: **74**: 70 content entries mapped through `/[...slug]`, with `index` normalization (the content root is still owned by `pages/index.tsx`), plus `/`, `/404`, `/search`, and `/robots.txt`.
- Configured collection: `content` at `content/`, with the local JSON schema generated from `buildContentSchema()`.
- Effective plugin list: only the shared local copy-public workaround.
- Public assets: seven `public/images/dummy/*.webp` files (`beauty`, `corporate`, `laser`, `meeting`, `process`, `sustainability`, `vacuum`).
- Required island families: two `ThemeControlIsland` instances, `NavEnhancer`, `MobileNavEnhancer`, `ContextSwitcherEnhancer`, `SearchToggleEnhancer`, `ClientRouterBootstrap`, content-form enhancers, and the search enhancer. `PageLoadingOverlay` is self-wiring SSR markup, not an island. Header/sidebar `data-zfb-transition-persist` keys and theme state must survive soft navigation.
- Representative renders: `/`, `/company`, `/products`, `/lines/beauty`, `/news/news-01`, `/contact`, `/search?q=...`, `/404`, `/robots.txt`, and one dummy image URL.

### `packages/ui`

- The package is source-consumed by root and demo; it does not own zfb routes or a public directory.
- There are 72 story modules in the generated styleguide registry. Their paths and export order are an input to root's 72 detail routes.
- Client behavior used by demo includes the theme state and navigation/form/search enhancer modules. ProseMd owns a separate lazy browser md-wasm graph, sanitization, fence/highlight adaptation, and CSS.

## Decision matrix

`Keep` means local behavior remains authoritative. `Adapt` means retain ownership while changing to the new contract. `Replace` means the package becomes authoritative. `Delete` means no replacement behavior is wanted.

| Surface and exact paths | Owner | Decision | Locked result | Acceptance |
| --- | --- | --- | --- | --- |
| All four `package.json` files, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | #387 | adapt | Apply the exact versions above. Keep md-wasm where reachable; keep `diff`/KaTeX/zdtp direct reachability satisfied; remove history-server while history stays off and remove the unused Cloudflare adapter while every site is static. Remove obsolete next-only release-age entries and their stale comments. | Clean install has no unsatisfied non-optional peer; one zfb family version; no next.89, history-server, or adapter resolution. |
| Root/doc/app/UI `tsconfig.json`; root `src/components/content/code-group.tsx`; root `src/types/preact-jsx-globals.d.ts` | #387 | adapt/delete | Adopt zudo-doc's `react-jsx` + `jsxImportSource: preact` contract where applicable. Replace `React.ReactNode` with Preact structural types, then delete the global JSX compatibility shim and `@types/react` if the complete check proves no remaining consumer. Do not add React for zfb's optional React peer. | All workspace checks pass with `class`, Preact children, package islands, and source-consumed UI; dependency audit contains no accidental React runtime. |
| Root/doc `pages/lib/doc-page-props.ts`, `locale-merge.ts` and their imports | #387 | adapt | Rename to `_doc-page-props.ts` and `_locale-merge.ts`. No content or behavior change. | Neither route table contains `/lib/doc-page-props` or `/lib/locale-merge`; root/doc builds retain 86/22 pages. |
| Root `zfb.config.ts` composition | #388 | adapt | Retain thin `zudoDocPreset()` composition because root appends `componentDocs`, an extra markdown-link directory, and two local plugins after preset order. Do not wholesale switch to `zudoDoc()` and lose appended arrays. Add `strictContentBridge: true`. Remove only root's copy-public descriptor. Preserve port 4321, base, `bundle.mainFields`, Apply proxy, Composer provider, translations, colors, schema, directives, and route plugin ordering. | Deep inventory comparison proves all collections and plugins remain once, package routes render host context, content fallback fails build, public files are copied natively. |
| Root `src/config/settings.ts`, `settings-types.ts`, `i18n.ts`, `color-schemes.ts`, `docs-schema.ts`, tag/sidebars/frontmatter config | #388 | adapt | Preserve local navigation, header HTML token trigger, footer, base, route injection, content schema, colors, translations, custom home, `siteUrl` warning, and disabled feature values. Delete `headingIdStrategy` and any `githubAutolinksRepo`; add explicit `logo: "/img/logo.svg"`, `tocToggle: false`, and an `entryDocSlug` that resolves to `guide`. Keep `versions: []` off-equivalent and ensure version UI emits no bogus URL/payload. Keep GFM task lists/footnotes at the 5.x preset defaults. | Settings typecheck without removed keys; home keeps the project logo; `/docs/versions` has no unavailable-version payload when versioning is off; header/footer/search/theme values appear on injected pages. |
| Root package route context and `pages/lib/_chrome-bindings.tsx` | #389 | keep/adapt | Keep the host-callables bridge and its static import of `BodyEndIslands`. Adopt only 5.2 type/signature changes. Do not duplicate package defaults in bindings. | Injected docs/404/sitemap/robots use host strings, colors, search, header/footer, and hydrate host markers; llms remains a separate plugin artifact. |
| Root host routes: `pages/index.tsx`, `pages/components/**`, `pages/composer/**`, `pages/docs/versions.tsx`, `pages/preview/**`; remaining `pages/lib/**` except #387 helpers and `_body-end-islands.tsx` | #389 | keep/adapt | These are product routes, not obsolete scaffold. Preserve home/styleguide/Composer render and the static package-island registration paths. Adapt factory/config signatures only. | Host routes, 72 story detail paths, variants, preview frames, token page, Composer and injected routes render without duplicate/colliding markers. |
| Root product implementation: `src/features/styleguide/**`, `src/styleguide/**`, `src/features/composer/**`, non-panel `src/components/**`, and their unit tests | #389 | keep | Preserve the custom catalog, preview, code panel, Composer, file-provider boundary, persistence, and custom chrome. Package scaffold files are not substitutes. | Existing unit suites plus focused styleguide/Composer Playwright suites pass; generated story registry stays at 72 unless an intentional story change is separately approved. |
| Root style/token authority: `src/styles/global.css`, `src/styles/preview.css`, `src/features/{styleguide,composer}/**/*.css`, `packages/ui/styles/{tokens,colors}.css` | #389 | keep/adapt | Keep import order, zudo-doc package CSS, local semantic re-assertions, UI tokens, safelist, styleguide/Composer layers, and syntax token roles. Add only new required zudo-doc component roles; do not import the whole upstream scaffold theme or enable a theme pack/switcher. | Representative docs, styleguide, Composer, and preview iframe retain colors/layout in light/dark; token lint and generated-token checks pass. |
| Root local plugins: `plugins/composer-file-provider-plugin.mjs` + test, `plugins/zdtp-apply-proxy-plugin.mjs` + test | #389 / #392 | keep/adapt | #389 exclusively owns Composer provider compatibility; #392 exclusively owns Apply-proxy compatibility with the new panels. Neither plugin is scaffold glue. | Dev-only capability gates remain closed in build/preview; file persistence and panel Apply flows pass their focused tests. |
| Root `public/**` | #388 | keep | Keep every asset byte/path. zfb native copy replaces only the plugin registration. `copyPublicWithBase` remains default/false for base `/`. | All six files exist at the same built root paths; MSW behavior remains unchanged. |
| Doc `zfb.config.ts` | #390 | replace/adapt | Replace preset plumbing with `defineConfig(zudoDoc({...}))`. Preserve port 4323, site/base/nav/content/search/image/transition/claude-resource choices and set `strictContentBridge: true`. Remove manual schema/directives/translations/colors wiring and stale optional-peer comments. | Config is diff-from-defaults, route/plugin inventory matches baseline, strict bridge is active. |
| Doc route stubs | #390 | replace/delete | Replace `doc/pages/index.tsx` with the one-line package route re-export. Add/retain only the canonical self-contained `doc/pages/docs/[[...slug]].tsx` dynamic route stub. Delete all other obsolete route glue after proving package ownership. | `/` and all 12 docs pages work in build; the docs catch-all works in dev; injected routes win only where no host stub exists. |
| Doc `pages/lib/**` and `src/{components,config,types,utils}/**` | #390 | delete/replace | Delete scaffold copies made obsolete by `zudoDoc()` and package defaults, including local chrome/context/nav/settings/schema/i18n/color/frontmatter/sidebars/tag/z-index/component shims. Retain nothing merely because it existed in 4.3. If the canonical docs stub needs a callable, use only sanctioned package/virtual entrypoints. | Every deletion is covered by a package export or proven disabled. No local `pages/lib` island chain remains; no missing marker or route. |
| Doc `src/styles/global.css` | #390 | replace/adapt | Start from the 5.2 base scaffold CSS, then retain only deliberate local tight-token/content choices needed by rendered docs. Do not copy root's styleguide/Composer/UI layers. | Root and doc styles are not conflated; docs pass HTML/link checks and representative light/dark inspection. |
| Doc `scripts/setup-doc-skill.sh` and package scripts | #390 | adapt | Port the complete 5.2.1 script fixes while preserving this nested `doc/` workspace: `doc-wisdom` name, repo-root tracked skills, `--target claude|codex|both|auto`, worktree main-path resolution, nested prefix, physical symlink comparison, safe non-destructive tracked-skill linking, and valid format/verify command discovery. | Temp-repo tests cover main worktree, linked worktree, nested `doc/`, symlinked parent, dangling/correct/foreign links, Claude/Codex/both, and idempotency without deleting foreign entries. |
| Doc `public/**` | #390 | replace | Add the canonical 5.2.1 four-file favicon set. Do not copy root branding unless explicitly selected. | SVG link precedes ico/png fallbacks and four files are in `doc/dist` through native copying. |
| Doc content `doc/src/content/docs/**` and resource output behavior | #390 | keep/adapt | Keep all 12 articles and their routes. Update only statements invalidated by removed glue. Preserve `claudeResources: { claudeDir: "../.claude", scanRoot: ".." }`. | Content count/routes unchanged; generated resources do not scan output recursively and still describe the repo root. |
| Demo `apps/demo/zfb.config.ts` | #391 | adapt | Delete the copy-public plugin descriptor; rely on default `publicDir: "public"` with `copyPublicWithBase: false`. Correct comments that claim schema is unenforced or public copying is absent. Keep collection schema, base `/`, Tailwind, strip extension, and no trailing slash. | Config has no plugin; all seven images are copied at identical URLs; schema still rejects invalid content. |
| Demo `apps/demo/pages/**`, `layouts/**`, `components/**`, `lib/**`, `config/**`, `styles/**`, `content/**` | #391 | keep/adapt | Preserve all 74 routes, `index` normalization, native ClientRouter, View Transitions, persistent header/sidebar keys, loading events, theme storage, enhancer islands, refresh/direct-navigation behavior, and link shape. Apply stable zfb type/API changes only. | Route/asset diff is exact; transition, refresh, theme, event, navigation, link, and trailing-slash suites pass. |
| Root panels: `pages/lib/_body-end-islands.tsx`, `src/components/{design-token-panel-bootstrap,preview-token-panel-bootstrap}.tsx`, `src/lib/{design-token-panel-bootstrap,preview-token-panel-bootstrap}.ts`, `src/config/{design-token-panel-config,preview-token-panel-config}.ts` | #392 | replace/adapt | Replace queue globals and eager zdtp glue with the 5.2 native lazy bootstrap contract. Keep two instances, storage prefixes, namespaces, modal prefixes, export filenames, shared and per-instance toggle channels, Apply proxy behavior, preview isolation, and console helpers (or document an equivalent supported API). Keep a static import path for registration. | No zdtp bytes in clean eager islands; non-empty persisted/open/owner state restores first paint; `{}`, `[]`, and `null` remain lazy; first pre-hydration click, import retry, current-channel replacement, and dual-instance isolation pass. |
| UI prose: `packages/ui/src/content/prose-md/**` and focused ProseMd/Composer prose tests | #392 | adapt | Upgrade to md-wasm 2.2. Keep lazy import, stale-result guard, sanitization, and safe failure. Re-evaluate but do not blindly delete the fence scanner: remove it only if the 2.2 public API reproduces build class-mode language-aware semantic markup. Align task-list/footnote GFM with zudo-doc 5 defaults and retain CJK/hierarchical headings. | Built output has a content-hashed WASM asset; nested fences, diagnostics, wrapping, sanitization, and light/dark semantic `hi-*` tokens match build output. |
| Focused browser/config tests | #389 / #391 / #392 | keep/adapt | #391 owns `e2e/demo-{smoke,refresh,transition}.spec.ts`. #392 owns `e2e/preview-token-panel.spec.ts`, `e2e/composer-prose*.spec.ts`, `playwright.prose-window-blur.config.ts`, `src/config/__tests__/panel-config-isolation.test.ts`, and `src/lib/__tests__/token-panel-lazy-gate.test.ts`. #389 owns the remaining root `e2e/*.spec.ts` and Playwright configs. | Each owner updates only assertions caused by its behavior; no suite is weakened or moved to #393. |
| Shared `plugins/copy-public-plugin.mjs` | #393 | delete | Delete only after #388 and #391 remove both registrations. | Repository search finds no references; root/demo assets have already passed native-copy checks. |
| Root docs and stale-workaround prose: `CLAUDE.md`, `README.md`, `ADOPTING.md`, `DEPLOY.md`, `TESTING.md`, `.check-links-allowlist` | #393 | adapt | Remove only obsolete next.89, stage-escape, local public-copy, github-autolinks, zudo-doc-4, old schema, and old scaffold-glue claims. Do not rewrite durable product architecture, manifests (owned by #387), or `doc/CLAUDE.md` (owned by #390). | Grep audit has no false current claims; commands and path ownership agree with the implemented tree. |
| Generated outputs and all previously owned implementation files | owning issue, verified by #393 | keep/verify | #393 runs drift checks but does not regenerate or edit another issue's files. Drift is returned to the owning issue before final verification. | Generator/check commands are clean at the merged HEAD; #393 has no cross-scope implementation edits. |

## Downstream issue body contract

The manager must add the following decisions to the named issue bodies before dispatch. These statements narrow the existing goals and remove overlaps.

### #387 — dependency/build baseline

- Add the exact dependency table above, including removal of history-server and the unreachable Cloudflare adapter, retention of md-wasm/diff/KaTeX/zdtp reachability, addition of doc's direct zdtp dependency, and the zfb optional-React rule.
- Add exclusive ownership of all manifests/lock/workspace and all four tsconfigs; root `code-group.tsx`/JSX shim typing migration; and only the two root/doc helper renames plus their import-reference edits.
- Add acceptance: `react-jsx`/Preact structural types, no accidental React runtime, one stable zfb resolution, no next/history-server resolution, and exact 86/22/74 build counts.
- Explicitly prohibit behavioral config, route, chrome, public-copy, and token-panel changes.

### #388 — root integration

- Add exclusive ownership of root `zfb.config.ts`, root config modules/settings tests, and root `public/**`; no ownership of host route/chrome or panel implementation files.
- Lock the advanced preset composition, appended-array order, `strictContentBridge: true`, root public-plugin registration removal, explicit logo/TOC/entry-doc choices, removed setting cleanup, version-off behavior, and native-copy checks.
- Add acceptance for the complete collection/plugin order, host settings on package routes, six public assets, three root docs, 72 component paths, and absence of duplicate plugin behavior.

### #389 — root chrome/styleguide/Composer

- Add exclusive ownership of the root host pages/lib bridge (except #387 helpers and #392 body-end), root styleguide/Composer/features, and root/UI theme CSS named above.
- Lock `keep` for product routes and the host-callable/static-registration chain; only adapt 5.2 signatures and new required token roles.
- Add acceptance for representative render and island-marker inventories, 72 story routes, injected-route hydration, theme authority, and no version payload while off.

### #390 — doc modernization

- Add exclusive ownership of `doc/**` except the manifest/tsconfig and helper rename owned by #387.
- Lock `zudoDoc()` composition, only index + canonical docs catch-all stubs, deletion of legacy glue, base-scaffold CSS with deliberate local delta, four favicons, 12 content routes, and resource config.
- Add the full setup-doc-skill path/symlink/target acceptance matrix above. Assign `doc/CLAUDE.md` here and remove it from #393's editing scope.
- Require a deletion ledger mapping each removed file to a package export/default or disabled feature.

### #391 — demo migration

- Add exclusive ownership of `apps/demo/**` except manifest/tsconfig owned by #387, plus demo-focused e2e specs.
- Lock default native `publicDir`, `copyPublicWithBase: false`, removal of registration only, correction of stale schema/copy comments, all 74 routes/seven assets, and the complete router/persistence/theme island set.
- Explicitly prohibit shared plugin deletion.

### #392 — token panels and WASM

- Add exclusive ownership of the exact root panel/body-end paths and `packages/ui/src/content/prose-md/**`; #392 must not edit `zfb.config.ts`, general settings, or shared theme files.
- Lock native 5.2 lazy bootstrap with two configurations; retain the static registration chain and all per-instance identifiers/Apply/console behavior.
- Lock md-wasm 2.2 adaptation with sanitizer and fence-scanner evidence rule, zudo-doc 5 GFM parity, hashed WASM and semantic highlighting checks.

### #393 — cleanup/confirm

- Narrow edits to deletion of `plugins/copy-public-plugin.mjs` and the named root documentation/comment surfaces. Remove `doc/CLAUDE.md`, product/config files, manifests, and generated implementation files from its edit ownership.
- Make every generated command a verification gate; route drift back to the owning issue instead of editing across scopes.
- Require final 86/22/74 route counts, plugin/public/island inventories, clean install/peer audit, every build/link/HTML/unit/generator/token gate, and the existing browser suites named in the issue.

## Global acceptance additions

1. Capture machine-readable route lists (not counts alone) for root/doc/demo after #387 and after #393; diff must be empty except intentional canonical stub ownership changes that preserve URLs.
2. Capture ordered configured collections/plugins and public file lists after #387 and #393. Root loses only copy-public; demo loses its only plugin; doc changes implementation, not effective feature set.
3. For each representative HTML file, record title, canonical/robots state, stylesheet and island marker names. A marker count without names is insufficient because zfb resolves collisions by marker identity.
4. `strictContentBridge` must be exercised with a temporary invalid MDX fixture and shown to fail root and doc builds; remove the fixture afterward.
5. Verify native public copying in both root and demo, including base-aware behavior by config assertion and actual built paths. Do not infer success from dev serving.
6. Peer reachability must be checked from each workspace manifest, not only from a hoisted monorepo install.
7. Browser checks must cover first load, soft navigation, back/forward, direct refresh, light/dark, narrow/wide layout, and JS-disabled SSR fallbacks where the feature claims them.

## Non-goals

- No wholesale copy of zudo-doc or zfb showcase/scaffold source into root.
- No replacement of root styleguide, Composer, custom home, custom chrome, UI tokens, Apply proxy, or file provider with package defaults.
- No enabling versions, doc history, HTML preview, AI assistant, theme-pack switcher, tags, changelog, i18n, the currently-disabled sitemap setting, or new demo product features. The always-injected `/sitemap.xml` route itself remains in the baseline.
- No addition of the Cloudflare adapter to the static demo and no deployment-platform migration.
- No content rewrite, route rename, public-asset rename, story-count change, or trailing-slash policy change.
- No removal of sanitization or local WASM fence adaptation without output-parity evidence.
- No upstream bug report containing zudo-sg private/product-specific material; reduce any genuine upstream defect to a public minimal reproduction.

## Residual risks to watch

- zudo-doc's preset settings merge is shallow. Passing partial nested `home`, `footer`, `metaTags`, or `colorMode` objects can silently discard defaults; use complete values and inspect output.
- Package-injected routes hydrate custom islands only while a scanner-visible static chain remains. A successful typecheck does not prove marker registration.
- A workspace-hoisted optional peer can hide an invalid consumer manifest. Run isolated or filtered install/build checks.
- Native `public/` is served directly in dev but copied only on build; dev success is not asset-copy evidence.
- zfb-md-wasm 2.2 expands its API but does not by itself prove ProseMd's exact class-mode output. Compare semantic HTML and hashed asset graphs before deleting compatibility code.
- The 86/22/74 counts came from the isolated latest-stack planning build. If a count differs, save the full route diff and resolve ownership; do not bless a new count from totals alone.
