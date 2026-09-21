# ADR: Styleguide engine package (`@takazudo/zudo-sg`) — seam and contract

Status: **Accepted** (epic #648, decision sub-task #650, 2026-09-13).
Locks the contract every Wave 2+ sub-issue implements. Model: zudo-doc's
package-owned route seam (`$HOME/repos/myoss/zudo-doc/packages/zudo-doc/docs/adr/route-injection-seam.md`).
Current toolchain pins: `@takazudo/zfb` **2.20.0**, `@takazudo/zudo-doc`
5.26.2, `@takazudo/zdtp` 0.8.0, pnpm 11.5.2, Node 24. The engine's peer
floors are `^2.20.0` / `^5.26.2`, aligned with zudo-doc 5.26.2's own
`@takazudo/zfb` peer floor (#731).

## Context

zudo-sg's catalog (`src/features/styleguide/**`, `src/styleguide/data/**`,
`pages/components/*`, `pages/tokens.tsx`, six codegens, the preview CSS
"two worlds" dance) is 100 % host code. Every consumer copies it and decays
(zzmod is 70 commits behind). The epic turns it into an installable engine
package built the way `@takazudo/zudo-doc` is built. Before the move, a
throwaway spike (`__inbox/engine-seam-spike/`, gitignored, not committed)
proved the seam end-to-end against zfb 2.16 and surfaced three facts that
change the plan the epic was written with. They are recorded first because
the decisions below depend on them.

### Spike findings that override the epic text

1. **The node_modules virtual-module gap is closed in zfb 2.16.** A route
   entrypoint whose realpath is under `node_modules/.pnpm/…/routes-src/`
   imports `virtual:zudo-sg-context` / `virtual:zudo-sg-registry` and builds
   (packed-tarball host, `stage: "never"`). `paths()` is extracted from that
   `.tsx` and both injected islands register. **No `routes-src` staging is
   needed** for the virtual channel. zudo-doc's staging predates this fix.
2. **A `.zudo-sg/` stage dir cannot work in zfb 2.16.** The bundler's shadow
   mirror prunes every hidden directory and honours `.gitignore`; the ONLY
   hidden staging surface it materialises is the hardcoded allowlist
   `.zudo-doc/routes-src/**` (`crates/zfb-build/src/bundler.rs`
   `KNOWN_FIRST_PARTY_STAGING_DIRS`, zfb #1840). Staging into
   `.zudo-sg/routes-src/` fails the build with
   `Could not resolve "../.zudo-sg/routes-src/components-slug.tsx"`.
   Combined with (1), the engine does not stage at all; the only working
   staging fallback is `<projectRoot>/.zudo-doc/routes-src/zudo-sg/` (proven).
3. **zfb's island scanner does not walk `virtual:` specifiers** (it skips every
   bare specifier — `crates/zfb-islands/src/scanner.rs` `Resolver::resolve`).
   A `"use client"` component reached ONLY through the host registry behind
   `virtual:zudo-sg-registry` gets its SSR marker but no manifest entry
   (`⚠ island marker "Counter" … has no matching registry entry and will not
   hydrate`). Islands the package route imports statically register in every
   shape. Two proven ways to register a host island on package routes:
   (a) any host `pages/` file statically imports the module (the island
   manifest is site-wide — `pages/index.tsx` importing the registry registered
   `Counter`), (b) staging with a generated **relative** real-file re-export
   (`_registry-source.ts`) instead of the virtual module. (a) costs nothing and
   is the contract; (b) is the recorded fallback.
4. **`zfb dev` never scans injected package routes for islands** (found by the
   manager's browser check, amendment 2026-09-13). `crates/zfb/src/commands/dev.rs`
   `rebundle_islands` seeds the island scanner from the host's `pages/` root
   ONLY and passes an empty package-route entrypoint list ("dev's injected
   routes are served live, not materialised — #1193 … codex P1 is
   build-only"), while `zfb build` seeds every injected entrypoint
   (`build.rs` "Seed package-route islands from each route's REAL
   entrypoint"). Consequence: an island reachable only through a package route
   registers in the build but NOT in dev — the dev log says
   `no "use client" islands found; skipping islands bundle`, the preview page
   ships no `islands.js` and `ConfiguredPreviewApp` never mounts. Reproduced in
   BOTH shapes: the packed host (realpath under `node_modules`) and the
   workspace-linked host (realpath outside `node_modules` — the root zudo-sg
   dogfood case). So finding 3's rule generalises: **every island that must
   hydrate in dev is statically reachable from a host `pages/` file**, package
   islands included. Fix proven in dev with curl + Playwright (both shapes): a
   package subpath `@takazudo/zudo-sg/islands` statically imports every engine
   island (incl. `../routes-src/_preview-app.tsx`), and the host's
   `pages/index.tsx` imports it once — `/assets/islands.js` then contains
   `ConfiguredPreviewApp` and `Counter`, `html[data-sg-preview-hydrated="1"]`
   is set, the previewed button computes `rgb(37, 99, 235)`, zero console
   errors; the build is unchanged (the same island reached through two graphs
   is deduped by path, no collision warning).

   **Amendment 2026-09-16 (zfb 2.18.0, #707):** superseded. zfb 2.18.0 seeds
   `rebundle_islands` with the injected package-route entrypoints and
   resolves plugin virtual modules in the island scanner
   (zudo-front-builder PR #3025, release notes 8c65f033 / 200452e6 /
   d4a66b52) and seeds the dev CSS content globs from injected routes
   (PR #3026, f9f56aa7). Re-measured on the packed `fixtures/engine-host`
   with the seed removed: `/styleguide/assets/islands.js` 200 with manifest
   entries for `ConfiguredPreviewApp` (from the package route
   `routes-src/_preview-app.tsx`) and for a host `Counter` reached only
   through `virtual:zudo-sg-registry`; the same seedless host on zfb 2.17.0
   still 404s. The `@takazudo/zudo-sg/islands` seed and both host shims stay
   as a harmless no-op (public subpath, one release after 0.1.0), not as a
   requirement.

## Decisions

### 1. Package name and location

`@takazudo/zudo-sg`, workspace directory `packages/styleguide`, `private: true`
until #668 flips it for publishing. Public npm scope proven by
`@takazudo/zudo-doc`; the git-spec alternative (`@zudo-sg/styleguide`, like the
`@zudo-sg/ui` provider handoff) is rejected — that handoff shows the pain of
SHA-pinned git specs for every consumer. The npm name is checked by hand
before the first publish; the epic never publishes.

**Addendum (2026-09-14, #689):** the provider-handoff mode referenced above no
longer exists — it was removed (#686) and the package it named was renamed
from `@zudo-sg/ui` (`packages/ui`) to `@zudo-sg/demo-ui` (`packages/demo-ui`)
(#685). The SHA-pinned-git-spec rationale is kept verbatim as historical
context for the npm-vs-git-spec naming choice.

### 2. Dist build, shipped route sources

tsup with `bundle: false` (1:1 `src/<path>.ts(x)` → `dist/<path>.js`, keeps
`"use client"` directives), declarations by a separate
`tsc -p tsconfig.build.json` pass, `exports` map append-only (one subpath per
feature dir; types + default per entry). Route entrypoints are shipped as
**`.tsx` source** under `routes-src/` (zfb extracts `paths()` by AST from the
source file; a compiled `.js` fails with "no top-level `paths` export"):
`scripts/copy-routes-src.mjs` copies `src/routes/*.{ts,tsx}` → `routes-src/`
rewriting `../<seg>/…` → `@takazudo/zudo-sg/<seg>` and `../<file>.js` →
`@takazudo/zudo-sg/<file>`; `scripts/check-routes-src.mjs` guards presence +
no residual parent-relative imports; `virtual-modules.d.ts` is generated from
`src/routes/_virtual.d.ts`. Plugins are loaded by zfb's Node plugin host and
must be JS: `dist/plugins/*.js`. `packages/styleguide` is consumed from `dist`
even inside the workspace; `scripts/run-root-build.mjs` gains an
`ensure-styleguide-build` pre-step (zudo-doc's `ensure-workspace-build.mjs`
shape: every literal `./dist/**` exports target must exist, else build).
Source-only exports (the `@zudo-sg/ui` shape) are rejected: plugins must be
JS, and the safelist generator scans `dist`.

### 3. Story contract home — option (ii), duplicated structural types + drift check

- Canonical: `packages/styleguide/src/stories/types.ts`, exported as
  `@takazudo/zudo-sg/stories` (`StoryMeta`, `Story<P>`, `StoryControl<P>`,
  `StoryModule`, `defineStory`).
- `packages/ui/src/stories/types.ts` keeps a **byte-equivalent copy** of the
  type body (header comment may differ) so the provider tarball stays
  installable and type-resolvable with NO engine installed — `@zudo-sg/ui`'s
  barrel re-exports the story types, and consumers typecheck the provider from
  source (`exports` → `./src/*`), so any `import … from "@takazudo/zudo-sg/…"`
  inside the provider would be a TS2307 in every external consumer.
- Drift guard: `scripts/check-story-contract-sync.mjs` (root; compares the
  two files after stripping the leading comment block; wired into `pnpm check`).
- Verification of the choice: `scripts/verify-ui-provider-install.mjs`'s
  fixture consumer gets `src/story-contract.ts` importing
  `type { Story, StoryMeta, StoryModule }` and `defineStory` from `@zudo-sg/ui`
  and calling `defineStory(...)`; the existing `pnpm run typecheck` step then
  proves the contract resolves from the installed tarball (owner: #652).
- Rejected: (i) engine as optional peer + `import type` shim — the barrel
  re-export makes the shim a hard type dependency for external consumers;
  (iii) a third `stories` package — a publish and a peer for ~120 lines of
  types.

**Addendum (2026-09-14, #687):** the external-consumer justification above no
longer applies — the standalone provider-package mode and its CI verification
were removed (#686), so nothing typechecks `@zudo-sg/ui` from a bare tarball
without the engine installed. `packages/ui/src/stories/types.ts` now
re-exports the canonical types (and `defineStory`) from
`@takazudo/zudo-sg/stories` instead of duplicating them; `@takazudo/zudo-sg`
was added as a real `workspace:*` dependency of `packages/ui`. The file
itself is kept (not inlined at import sites) because the engine's
`new-component` scaffold (`packages/styleguide/src/cli/scaffold/`) generates
relative `../stories/types` imports and its tests assert that path.
`scripts/check-story-contract-sync.mjs` and `check:story-contract-sync` are
deleted — a re-export cannot drift. `packages/ui`'s `typecheck`/`test`
scripts now run `node ../../scripts/ensure-styleguide-build.mjs` first, since
the engine's `./stories` export resolves through `packages/styleguide/dist`.

**Addendum (2026-09-14, #689):** `packages/ui` above is the package's former
path. It was renamed to `packages/demo-ui` (`@zudo-sg/demo-ui`) in #685; the
re-export at `packages/demo-ui/src/stories/types.ts` and the
`ensure-styleguide-build.mjs` pre-step described above are otherwise
unchanged.

### 4. Preview stylesheet — standalone compile, one URL

- Host option `previewStyles` (required, project-root-relative path, e.g.
  `./src/styles/preview-entry.css`), compiled by
  `@takazudo/zudo-sg/plugins/preview-css` with `@tailwindcss/node`
  (`compile` → `@tailwindcss/oxide` `Scanner` over `compiler.sources` +
  `compiler.root` → `compiler.build(candidates)` → `optimize`). Package
  `dependencies`: `@tailwindcss/node ^4.2.0`, `@tailwindcss/oxide ^4.2.0`.
- Option `previewCssUrl`, default **`/_zudo-sg/preview.css`**. Dev:
  `devMiddleware` registers `${stripTrailingSlash(base)}${previewCssUrl}`
  (zfb matches the FULL URL; `base` read from `ctx.config.base`), serves
  `text/css; charset=utf-8`, `cache-control: no-store`, recompiles when any
  compile dependency's mtime changed (the entry + every `onDependency` path).
  Build: `postBuild` writes **`<outDir>/<previewCssUrl>`** — NOT nested under
  the base segment — mirroring zfb's own `dist/assets/*` (linked as
  `<base>/assets/*`) and zudo-doc's `search-index.json`. `previewMiddleware`
  registers the same handler so `zfb preview` serves it too.
- **Cascade rule (mandatory):** zfb injects the single global stylesheet into
  every route, after the preview `<link>`, and has no per-route opt-out. The
  compiler therefore rewrites `:root, :host {` → `:root[data-sg-preview-doc], :host {`
  and `:root {` → `:root[data-sg-preview-doc] {` (the zzmod rule) so the
  preview world's tokens beat the host bundle's colliding `--color-*` at
  specificity (0,1,1) vs (0,1,0). The preview document's `<html>` carries
  `data-sg-preview-doc`.
- Host consequence: `src/styles/preview.css` and the `@theme` re-assertion
  block in `src/styles/global.css` are deleted (#663); the root
  `src/styles/preview-entry.css` = `tailwindcss/preflight` + `utilities` +
  `@zudo-sg/demo-ui/styles/tokens.css` + `colors.css` + `@source "../../packages/demo-ui/src"`.

### 5. Categories are data

`StoryMeta.category: string`. Host `categoryOrder: string[]` in
`zudo-sg.config.mjs` drives group order; categories not listed are appended
after the listed ones in alphabetical order (never dropped, never an error).
`STORY_CATEGORIES`, `StoryCategory`, `gen-story-categories.mjs` and the
`GENERATED:STORY_CATEGORIES` marker blocks are removed (#651).

### 6. Route patterns

Option `routes` with defaults
`{ componentsIndex: "/components", componentsSlug: "/components/[slug]", componentsPreview: "/components/preview", tokens: "/tokens" }`;
entrypoints `routes-src/{components-index,components-slug,components-preview,tokens}.tsx`.
Every internal href is built from `sgContext.routes` + `withBase`, never a
literal. A host `pages/` file with the same URL shape shadows the injected
route silently (zfb precedence) — that is the documented escape hatch, not a
bug.

### 7. What the host keeps

`pages/index.tsx` (zfb can inject `/` since 2.16 but the root page stays
host-owned: it is the site identity and it is the host's static-import root
for site-wide islands), `pages/docs/versions.tsx`, `pages/preview/contact.tsx`

+ `src/features/styleguide/preview-demos/`, `pages/lib/_chrome-bindings.tsx` +

`_body-end-islands.tsx` (doc-chrome token panel stays host-owned),
`src/config/settings.ts` + `zfb.config.ts` (zudo-doc config),
**`zudo-sg.config.mjs`**, the generated registry
**`src/styleguide/sg-registry.ts`** (committed; `zudo-sg gen-registry --check`
in CI), `src/config/ui-design-tokens-manifest.ts` (generated by the CLI),
`packages/demo-ui/styles/*.css` (token CSS), `src/styles/preview-entry.css`.
**Island rule (amended for finding 4; relaxed 2026-09-16):** every
`"use client"` component that must hydrate on an engine route is reached by
the island scanner either through the injected route entrypoints (zfb ≥
2.18.0 in both build and dev, plugin virtual modules included) or through a
static import from a host `pages/` file. The host keeps one shim,
`pages/lib/_zudo-sg-islands.ts`, containing exactly
`import "@takazudo/zudo-sg/islands";`, imported by `pages/index.tsx` (which
already reaches the preview token panel through `_body-end-islands.tsx`) —
retained for `@takazudo/zudo-sg/islands` API stability; it is a no-op on the
engine's zfb peer floor. `@takazudo/zudo-sg/islands` (`src/islands.ts` →
`dist/islands.js`) is a
side-effect module that statically imports every engine island:
`DetailWorkbench`, `CodePanel`, `CatalogFilter`, `PreviewTokensButton`, the
preview token panel bootstrap, and `../routes-src/_preview-app.tsx` (the
configured preview wrapper, which lives in `routes-src/` because it imports
the registry virtual module; the relative escape from `dist/` into
`routes-src/` is deliberate and resolves in the published tarball).
`fixtures/engine-host` (#665) ships the same shim. Stories' components need nothing: catalog thumbs are SSR-only and the
preview app is one client island whose bundle carries the story closures.

### 8. Framework scope

Preact/zfb hosts only. React 19 hosts (zudo-text, pgen) are an explicit
non-goal. The seam that would enable them later: a fourth host-path option
`previewRendererModule` (host module exporting
`renderPreview(node, container)` / `unmountPreview(container)`), re-exported
as `virtual:zudo-sg-preview-renderer` with the same resolve/guard rules as
decision 10; the routes-only preview wrapper would import it instead of
Preact's `render`. Not built in this epic.

### 9. Composition API

`import { zudoSg, withZudoSg } from "@takazudo/zudo-sg/config"` (pure data,
no `node:` imports — loadable by zfb's node-free config evaluation).
`zudoSg(options)` returns `{ plugins, collections }`:

- `plugins`: `{ name: "@takazudo/zudo-sg/plugins/routes", options }`,
  `{ name: "@takazudo/zudo-sg/plugins/preview-css", options }`, and
  `{ name: "@takazudo/zudo-sg/plugins/zdtp-apply-proxy", options }` (dev-only
  by construction; from #657). Bare-specifier descriptors, never imported
  functions.
- `collections`: one per `componentsRoots[i].dir` —
  `{ name: "componentDocs" (i = 0) | "componentDocs<i>", path: dir, include: ["**/*.mdx"] }`.

Hosts write `plugins: [...preset.plugins, ...sg.plugins]`,
`collections: [...preset.collections, ...sg.collections]`;
`withZudoSg(presetFragment, options)` does exactly that merge (engine plugins
AFTER the zudo-doc preset's). The routes plugin fails at `setup()` when no
`@takazudo/zudo-doc/plugins/routes` descriptor is present in
`ctx.config.plugins` (its routes import `virtual:zudo-doc-route-context` /
`virtual:zudo-doc-chrome-bindings`; hosts need `packageOwnedRoutes: true`).
When that descriptor has an empty `settings.headerNav`, `withZudoSg` supplies
links to the resolved Components and Design Tokens routes and adds the search
control. A non-empty host nav is left untouched; `chromeDefaults: false`
disables this minimal-host default.

### 10. Cross-sub-task constants (Waves 5–6 branch on these)

| Constant | Value |
|---|---|
| Virtual modules | `virtual:zudo-sg-context` (export `sgContext`), `virtual:zudo-sg-registry` (re-exports `storyModules`, `storyExportOrder` from the host registry path) |
| `sgContext` shape (JSON only) | `{ base, routes, categoryOrder, uiPackageName, previewCssUrl, catalog: { title, intro }, componentDocs: Array<{ keyPrefix, collection }> }`; `uiPackageName` is nullable when omitted from config and is used for catalog labels (`componentDocs` added by #670) |
| Routes plugin options | `{ registryModule, routes, categoryOrder, uiPackageName?, previewCssUrl, catalog }`; `uiPackageName` is optional and is used for catalog labels (+ `tokensManifestModule`; + `componentDocs` from #670 — `zudoSg()` pairs each `componentsRoots[i]` registry key prefix with `componentDocs*` collection `i`, and the detail route resolves a story's doc from the root its key belongs to) |
| Preview-CSS plugin options | `{ previewStyles, previewCssUrl }` |
| Staging | **none** — inject `routes-src/*.tsx` from the package realpath (workspace or node_modules); no `.zudo-sg/` dir, nothing to gitignore |
| Route entrypoints | link assets only (`<link href={withBase(sgContext.previewCssUrl)}>`), read data from the virtual modules, call zudo-doc factories (`createRouteContext`, `createChrome`) — never plugin helpers |
| Preview island | `routes-src/_preview-app.tsx`: `"use client"`, default export `ConfiguredPreviewApp` (displayName equal), statically imported by `components-preview.tsx`, renders `<PreviewApp registry={registry}/>`; the registry travels as an in-bundle argument, NEVER as island props (`data-props` is JSON — render closures would be dropped) |
| Dev-hydration seed | `@takazudo/zudo-sg/islands` → `./dist/islands.js` (side-effect imports of every engine island + `../routes-src/_preview-app.tsx`); host shim `pages/lib/_zudo-sg-islands.ts` = `import "@takazudo/zudo-sg/islands";`, imported by `pages/index.tsx`. Kept for API stability; a no-op on zfb ≥ 2.18.0 (finding 4 amendment) — the same module reached through two graphs is deduped by path, so it is harmless in dev and build |
| Registry shim | `routes-src/_registry.ts` builds `createRegistry(storyModules, { categoryOrder, storyExportOrder })` once; every entrypoint and the preview wrapper import it |
| Stylesheet exports | `@takazudo/zudo-sg/styles.css` → `./styles.css` (hand-authored catalog chrome CSS, package root); `@takazudo/zudo-sg/safelist.css` → `./dist/safelist.css` (generated `@source inline(...)`) |
| Consumer CSS order | zfb discovers `styles/global.css`, falling back to `src/styles/global.css`. Declare `@layer zd-preflight, zd-flow;` → `tailwindcss/preflight` in `layer(zd-preflight)` → unlayered `tailwindcss/utilities` → zudo-doc `theme.css` (unless the host supplies its full token contract) → consumer token/component CSS → zudo-doc `safelist.css` → `content.css` → `features.css` → `page-loading.css` → `@takazudo/zdtp/dashboard/styles.css` → unlayered `@takazudo/zudo-sg/styles.css` → `@takazudo/zudo-sg/safelist.css` → host `@source` globs (project-root-relative in zfb's global entry) → optional project `@theme {}` overrides. Preflight is the only element reset; `theme.css` resets color tokens only (`theme-no-reset.css` omits that token reset). **Engine chrome colors no longer depend on this import order**: raw `--sg-*` defaults survive the reset, and an unlayered host `:root` override wins before or after the engine stylesheet (decision 14). The host's own `@theme` colors still need to follow the framework reset. Utilities must outrank `zd-flow`; engine CSS stays unlayered to compete with utilities; dashboard CSS follows content CSS to win ties with prose. |
| Host-path contract | option value = project-root-relative path string (absolute accepted); `resolve(ctx.projectRoot, value)`; must be an existing FILE; normalized to a forward-slash absolute path; the virtual module re-exports that absolute path verbatim (zfb remaps it into the shadow); missing/empty/directory → throw at `setup()`: `[zudo-sg] option "<name>" = "<value>" resolved to <abs> (relative to projectRoot <root>), which is not a file`; absent-and-required → `[zudo-sg] option "<name>" is required (project-root-relative path, e.g. "<example>")`. Shared module `packages/styleguide/src/host-paths.ts` (`resolveHostModule(projectRoot, optionName, value, { required, example })`, `withBaseUrl(base, path)`) |
| `zudo-sg.config.mjs` | `{ componentsRoots: [{ dir, importBase }], registryOut: "./src/styleguide/sg-registry.ts", categoryOrder, uiPackageName?: "@zudo-sg/demo-ui", barrelIndex, tokens: { cssFiles, manifestOut }, previewStyles: "./src/styles/preview-entry.css", previewCssUrl?, routes?, catalog? }`; `uiPackageName` is optional and only names the package used in generated usage snippets and catalog labels; the routes plugin's `registryModule` is `registryOut` |
| CLI | `bin: { "zudo-sg": "./bin/zudo-sg.js" }`; commands `gen-registry [--check]`, `new-component <name> --category <c> [--nested] [--skip-barrel]`, `gen-token-manifest [--check]` |
| Fallback if a zfb release reintroduces the node_modules virtual gap | stage `routes-src/` into `<projectRoot>/.zudo-doc/routes-src/zudo-sg/` (the only allowlisted hidden dir) and, when host islands must register through the registry, overwrite the staged `_registry-source.ts` with a RELATIVE re-export (`../../../src/styleguide/sg-registry.ts`; an absolute path bundles the live tree next to the shadow → two preact copies → `Cannot read properties of undefined (reading '__H')` at SSR) |

### 11. Package boundary

`files: ["dist", "bin", "routes-src", "virtual-modules.d.ts", "styles.css", "CHANGELOG.md", "README.md"]`.
The `doc/` workspace (zudo-sg-doc.takazudomodular.com), the root styleguide
site, `apps/demo`, `packages/ui` and `fixtures/` are not part of the package;
`scripts/check-pack.sh` (#668) packs and asserts the tarball has no `doc/`,
`pages/`, `src/content`, `apps/`, `packages/ui` paths and that every `exports`
target exists.

### 12. Release scheme

Stable only. `v*.*.*` tags publish `@takazudo/zudo-sg` to npm `latest`
(`publish-zudo-sg.yml`, `NPM_TOKEN`, provenance). No `next` channel, no
prerelease handling, no dist-tag cleanup. Version source of truth is
`packages/styleguide/package.json`; the first release is one `/l-make-release`
run from `main` after the epic merges.

### 13. Required peers and inherited host prerequisites

**Amendment (2026-09-15, #696 / #671):** reverse the original optional-peer
treatment of `@takazudo/zdtp`. It is now a required peer at `^0.8.0`: the
always-injected `/tokens` route value-imports `@takazudo/zdtp/dashboard`
through `token-dashboard/create-token-dashboards.tsx`, so a host cannot build
the engine without it. Gating that route behind another configuration option
is outside this release's scope. The apply proxy and lazy panel helpers keep
their import-failure guards as defensive handling; those guards do not make
the package optional.

The other engine peers are `@takazudo/zfb ^2.20.0`,
`@takazudo/zudo-doc ^5.26.2`, and `preact ^10.29.8`. These are floors, not
pins: the workspace and the foreign-install fixture install `@takazudo/zfb`
2.20.0 against the `^2.20.0` floor. A floor is raised only when an upstream
peer forces it.

**Amendment (2026-09-20, #731):** zudo-doc 5.26.0 requires the zfb 2.19.0
family, so the engine floors now follow at `^2.19.0` / `^5.26.0`. The host
uses `bundleZdtp: true` with `designTokenPanel: false` to keep its preview
token panel working without filtering an internal preset plugin. (It carried
two custom panels until the doc-chrome one was removed; `bundleZdtp` is now
load-bearing on its own, since bundling otherwise follows `designTokenPanel`
and would stub the loader the preview panel needs.)

**Amendment (2026-09-16, #710):** raised the `@takazudo/zfb` floor from
`^2.17.0` to `^2.18.0` and the `@takazudo/zudo-doc` floor from `^5.24.0` to
`^5.25.0`. This is forced, not elective: zudo-doc 5.25.0 raised its own
`@takazudo/zfb` peer floor to `^2.18.0`, so the engine's floor must follow to
keep resolving against it.

`diff` and `katex` belong to zudo-doc's dependency graph: its published
`dist/doc-history/index.js` and `dist/math-block/index.js` import them. With
`packageOwnedRoutes`, the bundler resolves those specifiers even when the
corresponding features are disabled. They remain inherited host prerequisites,
not engine peers. `packages/styleguide/README.md` classifies the complete
fixture dependency set and links the upstream packaging report.

### 14. Engine chrome color namespace

**Accepted (2026-09-21, #797 / #798).** Chrome consumes its own raw
`--sg-<role>` custom properties, declared outside `@theme` at the top of
`packages/styleguide/styles.css`. zudo-doc's `theme.css` resets
`--color-*: initial`: an earlier embedder `@theme` color disappears even
when its name is namespaced or its block is `static`. Borrowing the host's
bare roles also lets component palettes silently recolor engine controls.

Compile probes with `@tailwindcss/node` / Tailwind **4.3.1** established:

| Shape | Engine CSS after the framework reset | Engine CSS before the framework reset |
|---|---|---|
| `@theme static { --color-sg-border: … }` + `border-sg-border` | Token and utility emitted | Token wiped; utility emits nothing |
| Plain `--sg-border` + `var(--sg-border)` in CSS | Works | Works |
| Plain `--sg-border` + `border-[color:var(--sg-border)]` | Works | Works |

There is **no engine `@theme` color tier**. The eleven public roles are
`--sg-bg`, `--sg-fg`, `--sg-surface`, `--sg-surface-2`, `--sg-border`,
`--sg-border-strong`, `--sg-muted`, `--sg-accent`, `--sg-on-accent`,
`--sg-focus`, and `--sg-success`. This prefix matches the engine's existing
`--sg-header-h` and zudo-doc's raw `--zd-*` tier. `--color-sg-*` is forbidden
because the reset wipes it; `--sg-color-*` is a disconnected third spelling
and is also forbidden.

The defaults live in one **`:where(:root)`** block. Its zero specificity
allows an unlayered host `:root { --sg-border: … }` to override a role
whether imported before or after engine CSS, without `!important`. Two
ordinary `:root` blocks would still depend on source order: the namespace
avoids the Tailwind reset, while `:where()` provides the override contract.
Cascade layers still apply; a host override placed in a layer loses to
these unlayered defaults. Keep the host's overrides unlayered too.

`bg`, `fg`, `surface`, `muted`, `accent`, and `success` map directly to the
matching scheme-aware `--zd-*` properties. Every raw-tier reference has a
last-resort literal color; fallback `light-dark()` pairs keep a missing
upstream role usable in either scheme. The other five roles derive from
zudo-doc's raw colors through `color-mix(in oklch, …)`, never through the
host's `--color-*` aliases:

| Derived role | Light scheme | Dark scheme |
|---|---|---|
| `surface-2` | 10% `--zd-fg` + 90% `--zd-surface` | 29% foreground + 71% surface |
| `border` | 14% `--zd-fg` + 86% `--zd-bg` | 38% foreground + 62% background |
| `border-strong` | 31.5% `--zd-fg` + 68.5% `--zd-bg` | 66.7% foreground + 33.3% background |
| `on-accent` | 99% `--zd-bg` + 1% `--zd-fg` | 94% background + 6% foreground |
| `focus` | 95% `--zd-accent` + 5% `--zd-fg` | Same mix with the dark raw values |

The host owns `color-scheme`, as it does for zudo-doc. With the root host's
warm `.965` / `.185` background/foreground endpoints, the border lightness
is `.8558` / `.4814`, and the strong border is `.7193` / `.7053`: close to
its existing `.855` / `.480` and `.720` / `.705` ladders. The raised surface
is `.887` / `.4112`, close to the old component palette's `.885` / `.410`.
These ratios retain the hierarchy while following a host's zudo-doc palette.
Overriding one `--sg-*` role changes that role only; derived defaults read
`--zd-*` directly, so a full chrome theme should override all relevant roles.

CSS consumes `var(--sg-<role>)`. TSX uses bracket arbitrary values, with a
`color:` type hint for ambiguous utility prefixes:

| Old utility | Chrome utility |
|---|---|
| `bg-X` | `bg-[var(--sg-X)]` |
| `border-X` | `border-[color:var(--sg-X)]` |
| `outline-X` | `outline-[color:var(--sg-X)]` |
| `ring-X` | `ring-[color:var(--sg-X)]` |
| `text-X` | `text-[color:var(--sg-X)]` |

Retain variants such as `hover:` and `focus-visible:`. Never use the paren
shorthand, e.g. `border-(--sg-border)`: the package's
`scripts/gen-safelist.mjs` masks balanced `[...]` regions, then rejects
parentheses outside them. The shorthand is silently dropped from
`dist/safelist.css`. Bracket candidates survive `extractTokens()` and compile
through `@source inline(...)` even when a later theme resets colors.

**Host content is exempt.** `packages/styleguide/src/cli/scaffold/**`
generates host components; `src/cli/token-manifest/**` (under the same
package) reads their tokens. The `/tokens` dashboard displays host values,
and the preview canvas `<body class="bg-bg">` in
`src/routes/components-preview.tsx` must follow the host background. They
keep host tokens, as do root `src/`, `pages/`, and `apps/demo` UI. The
thumbnail's scoped `--color-*` declarations restore the previewed component
palette and remain separate from the surrounding chrome. Dashboard
light/dark inventory backgrounds retain their `--zdtp-dashboard-*` values.

Hosts that previously themed chrome via bare `--color-border` or other
component roles must move those overrides to `--sg-*`. This is a breaking
theming-hook change, planned as a minor engine release with a migration note.

**Non-color follow-up audit (zudo-doc 5.26.2, fixture host).** This decision
does not migrate geometry, typography, or elevation. The fixture imports
zudo-doc `theme.css` followed by its own
`fixtures/engine-host/src/styles/ui-tokens.css`; a focused Tailwind compile
emits the utility candidates listed below.

| Chrome dependency | Definition used by the fixture | Follow-up |
|---|---|---|
| `rounded-sm`, `rounded-md` / `--radius-sm`, `--radius-md` | Fixture `ui-tokens.css`: `0.25rem`, `0.5rem` | zudo-doc does not define these two sizes; controls and tiles currently require host tokens. |
| `rounded-full` / `--radius-full` | Both zudo-doc `theme.css` and fixture `ui-tokens.css`: `9999px` | Already supplied upstream; the fixture repeats the same value. |
| `text-xs`, `text-sm` | Fixture `ui-tokens.css`: `0.75rem`, `0.875rem`, with `1.5` line height | zudo-doc uses semantic sizes instead; code-panel labels, search status, and the demo link rely on these host sizes. |
| `text-heading` | zudo-doc `theme.css`: `--text-heading: var(--text-scale-xl)`, backed by `:root { --text-scale-xl: 3rem }` | Both the semantic alias and its raw scale value are supplied upstream; no fixture token is needed. |
| `--shadow-card` (selected `.sg-seg-btn`) | Fixture `ui-tokens.css`: `0 1px 2px #0000001a` | The engine has no chrome `shadow-*` utility call sites; this direct CSS reference still depends on the host. zudo-doc supplies `--shadow-lg`, while fixture `--shadow-raised` / `--shadow-overlay` are not used by engine chrome. |

Keep these remaining host prerequisites explicit in a later non-color token
decision; the color namespace alone does not make every chrome token
self-contained.

## Spike report — proof items (a)–(g)

Spike layout: `__inbox/engine-seam-spike/engine/` (minimal
`@takazudo/zudo-sg-spike`: `plugins/routes.js`, `plugins/preview-css.js`,
`host-paths.js`, `config.js`, `routes-src/*.tsx`, `src/registry.ts`,
`src/preview/preview-app.tsx`), a workspace-shaped host
(`__inbox/engine-seam-spike/host`, `link:../engine` → realpath outside
`node_modules`) and a packed host outside the workspace
(`/tmp/claude-1000/zudo-sg-engine-spike-host`, `pnpm pack` tarball installed
via `file:`, realpath under `node_modules/.pnpm/`, `base: "/spike/"`). Two host
stories: `Button` (plain) and `Counter` (`"use client"`, flagged so the catalog
route wraps its SSR thumb in `<Island>`).

| Item | Result | Evidence |
|---|---|---|
| (a) plugin registers `virtual:zudo-sg-context` (JSON) + `virtual:zudo-sg-registry` (host-path re-export) and injects `/components`, `/components/[slug]`, `/components/preview`, `/tokens` | **pass** | `info package route \`/components\` → pages/components.tsx` ×4; `dist/components/index.html` carries the serialized context (`registryModule: …/host/src/styleguide/sg-registry.ts`) |
| (b) dynamic `paths()` consumes the host registry synchronously | **pass** in all three shapes (workspace, staged, node_modules realpath) | `✓ 6 pages built` = `/`, `/components`, `/components/button`, `/components/counter`, `/components/preview`, `/tokens`; `dist/__zfb/routes.json` lists both slug params |
| (c) generated registry imports real host story modules and they render | **pass** | SSR HTML: `<button data-ui-button="accent" class="bg-accent text-bg px-hsp-md py-vsp-sm">Primary action</button>` on `/components`; detail page emits one `<iframe src="/components/preview?slug=button&variant=Primary">` per variant; the islands bundle contains the story closures (`"Primary action"`, `data-ui-counter`) |
| (d) two `"use client"` islands hydrate | **build: island 1 pass, island 2 pass under the locked rule. dev: BOTH fail without the host seed (finding 4); both pass with `pages/index.tsx` → `@takazudo/zudo-sg/islands` — browser-verified. Re-measured 2026-09-16 on zfb 2.18.0: dev passes for BOTH islands WITHOUT the host seed (finding 4 amendment).** | Build — island 1 `ConfiguredPreviewApp` (statically imported by the package preview route): SSR marker `data-zfb-island-skip-ssr="ConfiguredPreviewApp"` + manifest entry `…("default","ConfiguredPreviewApp","<pkg>/routes-src/_preview-app.tsx")` in `dist/assets/islands-*.js` in every shape. Island 2 `Counter` (reached only through the registry): marker `data-zfb-island="Counter" data-props='{"start":3}'` always; manifest entry ONLY when (i) a host `pages/` file statically imports the registry (`…("Counter","Counter","<host>/src/components/counter.tsx")`) or (ii) staged + relative file re-export; through the virtual channel alone zfb warns `island marker "Counter" … has no matching registry entry and will not hydrate` (scanner skips `virtual:`). Dev — without a host seed: `no "use client" islands found; skipping islands bundle`, `/assets/islands.js` 404, no `<script>` on the preview page (packed AND workspace hosts). With the seed (`import "@takazudo/zudo-sg-spike/islands"` + the registry import in `pages/index.tsx`): `/assets/islands.js` 200 (37–38 KB) containing `"ConfiguredPreviewApp"` and `"Counter"`, `<script type="module" src="/spike/assets/islands.js">` on the preview page; Playwright on `/spike/components/preview?slug=button&variant=Primary`: `hydrated: "1"`, `[data-sg-preview-app="button"]` rendered, button `background-color: rgb(37, 99, 235)`, `errs: []`; Counter clicks increment (manager's check). |
| (e) `zfb build` and `zfb dev` work | **pass** (both hosts) | build: `✓ 6 pages built`; dev (port 4391, curl): `/components`, `/components/button`, `/components/counter`, `/components/preview`, `/tokens` → 200; markers and iframes identical to build; livereload script present |
| (f) `pnpm pack` → install into a host OUTSIDE the workspace (realpath under `node_modules`) → builds | **pass, and no staging needed** | tarball = `config.js host-paths.js plugins/ routes-src/ src/ virtual-modules.d.ts`; installed at `node_modules/.pnpm/@takazudo+zudo-sg-spike@file+…/node_modules/@takazudo/zudo-sg-spike`; `stage: "never"` build injects from that realpath, resolves both virtual modules, extracts `paths()`, registers `ConfiguredPreviewApp` from the node_modules path, emits `dist/_zudo-sg/preview.css`; with `base: "/spike/"` HTML links `/spike/assets/*`, `/spike/_zudo-sg/preview.css`, `/spike/components/preview?…` while files sit at `dist/components/…`, `dist/assets/…` |
| (g) host `previewStyles` compiled with `@tailwindcss/node` served at a base-aware URL in dev and emitted in build | **pass** | dev `GET /spike/_zudo-sg/preview.css` → 200 `text/css; charset=utf-8`, `cache-control: no-store`; `/_zudo-sg/preview.css` → 404 (base honoured); editing the imported `ui-tokens.css` changed `--color-accent: #2563eb` → `#0a5` on the next request (recompile log: `preview css compiled (… 59 candidates, 4 deps)`); output contains the UI tokens (`--color-accent`, `--spacing-hsp-md: 1rem`), story utilities (`.bg-accent`, `.px-hsp-md`, `.py-vsp-sm`, `.text-bg`), zero host `--zd-*`/`#ff0000` values, and every token block rescoped to `:root[data-sg-preview-doc]`; build writes `dist/_zudo-sg/preview.css` (4576 bytes) |

Additional measurements: (1) staging into `.zudo-sg/routes-src/` fails
(`Could not resolve "../.zudo-sg/routes-src/components-slug.tsx"`); staging
into `.zudo-doc/routes-src/zudo-sg/` builds. (2) A staged real-file re-export
with an ABSOLUTE host path crashes SSR with the two-preact `__H` error; the
relative spelling works. (3) The host global bundle scanned the same component
sources, so `.bg-accent`/`.px-hsp-md` exist in BOTH stylesheets with different
token values — only the `:root[data-sg-preview-doc]` rescoping keeps the
preview faithful. (4) The engine's own `node_modules` must not carry a second
`preact` (workspace hosts dedupe via the store; the spike symlinked them).

### Browser checks (done)

- Packed host, `zfb dev`, `/spike/components/preview?slug=button&variant=Primary`:
  WITHOUT the host seed the island never mounts (finding 4); WITH
  `pages/index.tsx` → `@takazudo/zudo-sg-spike/islands` it mounts
  (`html[data-sg-preview-hydrated="1"]`, `[data-sg-preview-app="button"]`,
  computed background `rgb(37, 99, 235)` = the UI palette, not the host
  bundle's `#ff0000`, no console errors).
- Packed host, `/spike/components` with the `pages/index.tsx` registry import:
  clicking the `Counter` thumb increments (island 2 hydrates through rule 7).
- Not browser-checked: the built (`zfb build` + static serve) preview page —
  the build manifest is structurally identical to the dev bundle after the
  seed, and the build registered `ConfiguredPreviewApp` even without it.

## Consequences for the sub-issues

- #652: no `host-paths` staging concerns; engine `stories` types + provider
  copy + `check-story-contract-sync.mjs` + the verify-ui-provider-install
  story-contract file.
- #654: the preview island needs the no-props `"use client"` wrapper from the
  start (host `pages/lib/_configured-preview-app.tsx` until #662 moves it into
  `routes-src/_preview-app.tsx`); while the host pages still exist they are the
  dev seed, so nothing else is needed in Wave 3.
- #662: ship `src/islands.ts` → `@takazudo/zudo-sg/islands`; the no-stub
  build test must ALSO run `zfb dev` (or assert the dev islands bundle) with
  the `pages/lib/_zudo-sg-islands.ts` shim in the temp copy.
- #664: add `pages/lib/_zudo-sg-islands.ts` + its import in `pages/index.tsx`
  when the host catalog pages are deleted — without it `pnpm dev` loses every
  catalog island while `pnpm build` stays green.
- #665: the fixture host ships the shim; the verify script also boots
  `zfb dev` once and asserts `/styleguide/assets/islands.js` contains
  `ConfiguredPreviewApp`.
- #659: no staging, no `.zudo-sg/`; add the zudo-doc-routes-descriptor guard;
  `stage`/`registryChannel` options do not exist.
- #660/#663: `:root[data-sg-preview-doc]` rescoping is part of the compiler
  output; build emits `<outDir>/_zudo-sg/preview.css`.
- #664: no host route stub is required for hydration; keep `pages/index.tsx`
  importing `_body-end-islands.tsx` and add the islands seed shim above.

## Upstream notes (verified against zfb 2.18.0 / zudo-doc 5.25.0)

The six findings from #673 were re-checked against the current release source
and reported to their owning public upstream tracker. **All six are now
closed**, fixed by zfb 2.18.0 and zudo-doc 5.25.0. Findings 1 and 3 were not
just closed on trust — they were independently measured on the packed
`fixtures/engine-host` foreign install against a zfb 2.17.0 control that
reproduced the original failure
([#707](https://github.com/Takazudo/zudo-sg/issues/707#issuecomment-5693363709)).
The other four rest on their release notes alone.

1. **zfb dev now seeds package-route islands — fixed, measured here.**
   `rebundle_islands` previously scanned the host `pages/` root only, so an
   island reachable only through an injected package route hydrated in build
   but not dev. Fixed by zfb 2.18.0, *"Seed the dev islands scanner with
   package-route entrypoints"*. #707 measured it directly on the packed
   foreign install: with the host-side seed shim removed, `ConfiguredPreviewApp`
   still registers in the dev islands manifest with no `islands.js` 404,
   against a 2.17.0 control that reproduced the original failure
   (`no "use client" islands found`, `islands.js` 404). Under the engine's
   `@takazudo/zfb ^2.18.0` peer floor the host's `@takazudo/zudo-sg/islands`
   seed shim (`pages/lib/_zudo-sg-islands.ts`) is now a no-op safety net, not
   a requirement, and stays for that reason. Tracked in
   [Takazudo/zudo-front-builder#3003](https://github.com/Takazudo/zudo-front-builder/issues/3003)
   (closed `completed`; landed via the implementing epic
   [#3010](https://github.com/Takazudo/zudo-front-builder/issues/3010)).
2. **zfb's hidden-directory staging allowlist — fixed, workaround retired.**
   `KNOWN_FIRST_PARTY_STAGING_DIRS` previously admitted only
   `.zudo-doc/routes-src`, so a different package-generated hidden staging
   root had no declaration path. Fixed by zfb 2.18.0, *"Stage injected-route
   entrypoints and their import closure as exact files"*. This side's
   `.zudo-doc/routes-src` staging workaround was retired in #708. Tracked in
   [Takazudo/zudo-front-builder#3004](https://github.com/Takazudo/zudo-front-builder/issues/3004)
   (closed `completed`; landed via the implementing epic
   [#3019](https://github.com/Takazudo/zudo-front-builder/issues/3019)).
3. **zfb's island scanner now resolves plugin virtual modules — fixed,
   measured here.** A `virtual:` re-export could previously be resolved by
   the bundler but was not scanner-reachable, so its `"use client"` component
   could have an SSR marker without a manifest entry. Fixed by zfb 2.18.0,
   *"Resolve plugin virtual modules in the islands scanner"*. #707 measured
   it directly on the same packed foreign install: `Counter`, reached only
   through `virtual:zudo-sg-registry`, now gets a manifest entry with no host
   seed, against the same 2.17.0 control (no manifest entry, dev islands
   bundle skipped). Tracked in
   [Takazudo/zudo-front-builder#3005](https://github.com/Takazudo/zudo-front-builder/issues/3005)
   (closed `completed`; landed via the implementing epic
   [#3010](https://github.com/Takazudo/zudo-front-builder/issues/3010), the
   same epic as finding 1).
4. **zfb's duplicate `Cache-Control` on plugin responses — never applicable
   here.** `dispatch_plugin` previously appended `Cache-Control: no-store`
   after plugin headers, producing duplicate `Cache-Control` fields when a
   plugin supplied one. Fixed by zfb 2.18.0, *"Stop duplicating
   `Cache-Control` when plugin middleware supplies a valid value"*. This repo
   never had a surface for the bug: grepping `src/`, `pages/`,
   `packages/styleguide/src/`, `zfb.config.ts`, and `scripts/` finds no
   plugin middleware. Nothing changed on this side because there was nothing
   to fix. Tracked in
   [Takazudo/zudo-front-builder#3006](https://github.com/Takazudo/zudo-front-builder/issues/3006)
   (closed `completed`; landed via the implementing epic
   [#3008](https://github.com/Takazudo/zudo-front-builder/issues/3008)).
5. **zudo-doc's `HeaderWithDefaults` sidebar-nodes override — fixed,
   workaround retired in code.** It previously always derived the
   mobile-drawer tree, so a route needing a custom tree had to bind a
   replacement host `Header`. Fixed by zudo-doc 5.25.0, which added an
   optional `sidebarNodes` prop to `HeaderWithDefaultsProps`. #711 removed
   the bound-`Header` workaround entirely (commit `e9f130d`, merged into
   `base/zudo-deps-bump`); every route now renders the package default
   header. Tracked in
   [zudolab/zudo-doc#4212](https://github.com/zudolab/zudo-doc/issues/4212)
   (closed `completed`; landed via the implementing epic
   [#4217](https://github.com/zudolab/zudo-doc/issues/4217)).
6. **zudo-doc no longer stages `routes-src` for published package
   routes — fixed, workaround retired.** The underlying node_modules
   virtual-module gap was fixed by zfb 2.16's direct virtual-module alias
   path, but zudo-doc 5.24.0 still copied the route tree into
   `.zudo-doc/routes-src`. Fixed by zudo-doc 5.25.0, which removed that
   project-local staging step. This side's copy was retired in #708, which
   found `.zudo-doc/` already absent from both the root and `doc/` worktrees
   (gitignored, never checked out) and removed the now-stale `.gitignore`
   entries. Tracked in
   [zudolab/zudo-doc#4213](https://github.com/zudolab/zudo-doc/issues/4213)
   (closed `completed`; landed via the implementing epic
   [#4222](https://github.com/zudolab/zudo-doc/issues/4222)).
