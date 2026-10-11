# Packed zfb 4.3.1 / zudo-doc 6.0.0 spike (#926)

Recorded 2026-10-11 against base `30ff644`. Disposable project: `$HOME/.cache/zudo-sg-zfb4-spike/spike/`. All repository changes are evidence under this directory. No workspace/link dependency was used. The miniature route package was installed from `file:./zfb4-spike-routes-1.0.1.tgz`; the current engine tarball was used only to calculate peers, not to run its unbuilt modules.

Setup: `pnpm dlx create-zudo-doc@6.0.0 spike --yes --pm pnpm --no-git`, `pnpm install`, `pnpm add @takazudo/zdtp@0.8.6`, `pnpm add -D vitest@4.1.11 happy-dom@20.14.6 vite@7.3.5`. Runtime Node v24.13.1 (scaffold requires Node 22+) and pnpm 10.30.3. Scaffold dependencies resolve zfb/runtime/md-wasm **4.3.1**, zudo-doc **6.0.0**, zdtp **0.8.6**, Preact **10.29.8**. `zfb check` passes. Build and browser verification below were run by the coordinating agent through its guarded workflow.

Primary references: [zfb documentation](https://zfb.takazudomodular.com/docs/), [zudo-react testing](https://zfb.takazudomodular.com/docs/zudo-react/testing/), [zudo-doc 6 migration](https://zudo-doc.takazudomodular.com/docs/guides/migrating-to-zudo-doc-6/), plus installed package exports, declarations, and executed code. The web reader returned inaccessible errors; direct curl fetched the testing page. Other documentation fetches returned HTTP 403. Published declarations and runnable probes supply the evidence below; no undocumented API is assumed.

## (a) PASS — independent wind CSS compilation and root rescoping

Command (from disposable host):

```sh
pnpm exec zfb css --input preview/entry.css --output out/preview.css \
  --config preview/zfb.config.ts --project-root . \
  --source 'preview/components/**/*.tsx' --no-auto-source
```

Exit 0. Minimal inputs: [wind.config.ts](snippets/wind.config.ts), [entry.css](snippets/entry.css), [card.tsx](snippets/card.tsx). Complete output: [emitted-after.css](snippets/emitted-after.css).

```css
@layer zw-reset, zw-tokens, zfb-hi, base, components;
@layer zw-tokens {
  :root { --zw-color-accent: #123456; --zw-spacing-hsp-md: 1rem; }
}
.px-hsp-md { padding-left: var(--zw-spacing-hsp-md); padding-right: var(--zw-spacing-hsp-md); }
.bg-accent { background-color: var(--zw-color-accent); }
@media (min-width: 640px) { .sm\:grid-cols-2 { grid-template-columns: repeat(2,minmax(0,1fr)); } }
```

`text-caption` emits both size and leading. There are no implicit named tokens or breakpoints. An initial `0.25rem` spelling without its leading zero (`.25rem`) failed config validation: `ZW007: spacing values must be one nonnegative length-percentage`. Leading zeros fix it; CSS serialization may subsequently shorten them.

Post-processing `css.replaceAll(':root', ':root[data-sg-preview-doc]')` rescopes both emitted root rules; assertion reported `root rewrite PASS: 2`. See [emitted-scoped.css](snippets/emitted-scoped.css). This exact rewrite is proven for this emitted CSS. Production rewriting should still guard against occurrences inside strings/comments and should not accidentally scope styles intended for the host.

Development can spawn the same short-lived command after an input stamp changes. Stamp the entry CSS and its imported CSS graph, config and imported token/config graph, source file contents **and source glob membership** (add/remove/rename), explicit source flags/project root, and compiler version. The command exposes no `--watch`; a plugin owns watching/invalidation. Do not stamp generated output as input. CLI `--help` and `exports.txt` confirm no public CSS compiler export: zfb's runtime named exports and subpath export map contain no CSS/wind compilation API. This is a public-API conclusion, not a claim about private Rust implementation internals.

## (b) PASS — one host stylesheet can serve an iframe with token overrides

Command without an explicit `--source` (config `wind.sources.roots: ["components"]` is anchored to the config directory):

```sh
pnpm exec zfb css --input preview/entry.css --output out/before.css \
  --config preview/before.config.ts --project-root . --no-auto-source
```

The host's scanned library root supplies `bg-accent px-hsp-md text-caption`. Both iframe documents link to host-served CSS; their only local styling is [preview-overrides.css](snippets/preview-overrides.css). Real browser computed styles, [manager-wind.txt](manager-wind.txt):

```text
(default after-authored) backgroundColor: rgb(171, 205, 239), paddingLeft: 16px
(before-authored)        backgroundColor: rgb(255, 192, 203), paddingLeft: 16px
```

The pipeline emits a layer prelude, then layered token declarations. Generated utilities are **unlayered**. Default ordering places authored `.bg-accent { background-color: pink }` before the generated `.bg-accent`; the generated rule wins and reads the iframe's unlayered `--zw-color-accent: #abcdef`. `placement: "before-authored"` moves generated utility rules before authored globals, so equal-specificity pink wins. See [emitted-before.css](snippets/emitted-before.css). Layered token defaults lose to the small unlayered override sheet. This proves reuse, not isolation: host authored CSS/reset and all included utility selectors also apply inside that iframe. Package sources outside the config root need the documented `sources.packageRoots` channel; this fixture's library directory lives beneath the declaring config root.

## (c) PASS — an engine-owned Preact adapter mounts the zdtp dashboard

Commands: `pnpm pack --pack-destination ..` in `route-package`, `pnpm add ./zfb4-spike-routes-1.0.1.tgz` in host, `pnpm exec vitest run --reporter verbose`; guarded build plus preview/dev browser checks in (d).

Working recipe: [Dashboard.tsx](snippets/Dashboard.tsx) is a `"use client"` zudo-react component. It returns an empty div with an object ref, calls `scope.onActivate`, dynamically imports `zfb4-spike-routes/adapter`, and registers unmount cleanup. It also guards against import completion after disposal. [adapter.ts](snippets/adapter.ts) imports `h` and `render` from Preact and `TokenDashboard` from `@takazudo/zdtp/dashboard`, renders into that div, and returns `() => render(null, host)`. No Preact JSX is passed through zudo-react's renderer. Include `@takazudo/zdtp/dashboard/styles.css` in the real host CSS pipeline; the runtime fixture tests mounting and behavior, not dashboard visual design.

The host manifest contains **no `preact` dependency**. The packed adapter declares `preact: ^10.29.1`, compatible with zdtp 0.8.6's own dependency. Resolution probe:

```text
host preact dependency: undefined
adapter preact: .../.pnpm/preact@10.29.8/node_modules/preact/dist/preact.js
zdtp preact:    .../.pnpm/preact@10.29.8/node_modules/preact/dist/preact.js
same: true
```

The lockfile has one `preact@10.29.8` package entry. This proves deduplication for these compatible ranges and this install, not for arbitrary future ranges. Unit test renders `role="region" aria-label="Spike Dashboard"`; actual preview and dev browsers render `Spike Dashboard / 0 tokens / No tokens declared`, with two mounted islands and no page errors.

The inspected public leaves do not expose dashboard mount/unmount: `dashboard/index.d.ts` exports `TokenDashboard` and types/helpers; `astro/host-adapter.d.ts` ends `export {};` (side effects only); `server/index.d.ts` is the apply-handler API; `constants` is event/storage constants; `testing` is config/storage/testing helpers. The opaque root panel API is separate from `TokenDashboard`.

Opaque panel path also works on 6.0.0: the sixth test dynamically imports `@takazudo/zdtp`, calls real `bootstrapDesignTokenPanel(build)`, dispatches `toggle-design-token-panel`, waits for the real module config to become the unique `spikeOpaque` namespace and asserts `#tokenpanel-highlight-mount`. Output: `opaque bootstrap configured spikeOpaque ... <div id="tokenpanel-highlight-mount"></div>`. The new bootstrap implementation loads zdtp through `@takazudo/zudo-doc/zdtp-loader`; the engine's direct root import remains available. No mock supplied a panel implementation. The root bootstrap alone does not promise Astro-style `window.zudoDoc.showDesignPanel` console helpers; the test checks actual configuration and mount instead.

## (d) PASS — packed package route sources, MDX components, and islands

Minimal files: [foo.tsx](snippets/foo.tsx), [plugin.ts](snippets/plugin.ts), [Counter.tsx](snippets/Counter.tsx), [Dashboard.tsx](snippets/Dashboard.tsx), [host.config.ts](snippets/host.config.ts), [chrome-bindings.tsx](snippets/chrome-bindings.tsx), [package-manifest.ts](snippets/package-manifest.ts). Package exports `.` to `plugin.js`, ships `routes-src/foo.tsx` plus its statically imported `client/*.tsx`. Plugin injects `/foo` via an absolute `fileURLToPath(new URL(..., import.meta.url))` under the installed tarball. Host enables `packageOwnedRoutes: true`, sets `chromeBindingsModule`, and appends the descriptor to the zudo-doc preset's plugins. `defineConfig` takes **one** config object; passing preset + overrides as two arguments fails TS2554.

The source route imports `Island`, `getEntry`, the virtual chrome bindings, and the two statically reachable client components. `getEntry("docs", "getting-started/introduction")` + `<doc.Content components={{ h2: ... }}/>` emits two headings with `data-spike-mdx`. Counter uses `ssrFallback`; that deliberately produces a skip-SSR island marker and mounts on load. Dashboard uses normal SSR/hydration. zudo-react events use `on:click`, not `onClick` (`ZR_PROP_DIALECT` otherwise).

Commands, run by manager:

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm exec zfb build
pnpm exec zfb preview --host 127.0.0.1 --port 48331
pnpm exec zfb dev --host 127.0.0.1 --port 48332
# Bounded Chromium visit to /foo in each mode, click #spike-counter,
# inspect [data-zfb-island-mounted], dashboard, binding, and MDX headings.
```

[build.txt](build.txt): `info package route /foo → pages/foo.tsx`; `✓ 7 pages built`; `heavy-guard: verdict=PASS`. Built HTML at `dist/foo/index.html` contains compiled build identity `data-zfb-build="68d74eab645d9e9c"` (content-dependent), `Counter` skip-SSR marker, and `Dashboard` island marker. No hand-written runtime island registry or identity was supplied. Plugin staging is internal to zfb; package source remains the origin.

[manager-browser.txt](manager-browser.txt), both preview and dev:

```json
{"before":"0","after":"1","binding":"host binding works","mdx":2,"mounted":2,"errors":[]}
```

Scaffold's existing docs catch-all shadows the package docs catch-all; the log explicitly says user wins. This does not affect the `/foo` injection or its use of the package route virtual binding module. Both servers were stopped after bounded checks.

## (e) PASS with Vite 7 pin — zudo-react testing on Vitest 4 + happy-dom

Exact config/import lines: [vitest.config.ts](snippets/vitest.config.ts), [seams.test.tsx](snippets/seams.test.tsx).

```ts
import { createIslandTest, withIslandTestContext } from "@takazudo/zfb/zudo-react/testing";
import { renderToString } from "@takazudo/zfb/zudo-react/server";
// Vitest config:
esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" }
// test: { environment: "happy-dom" }
```

`pnpm exec vitest run --reporter verbose` → **6 passed** ([vitest.txt](vitest.txt)). Covers SSR → hydrate → click → `await t.flush()` → dispose, `mount()` mode, full-page rendering with `withIslandTestContext`, intentional DOM mismatch, real dashboard activation, and real opaque panel bootstrap. `dispose()` disconnects the test host. Mismatch diagnostic:

```json
{"code":"ZR_HYDRATION_MISMATCH","phase":"preflight","component":"Counter","expected":"#comment","actual":"#text","protocol":"zudo-react/1","build":"test"}
```

Caveat proven by initial failing run: Vitest 4.1.11 currently accepts Vite 8.3.4, whose OXC transform ignores `esbuild` options. Output: `Both esbuild and oxc options were set ... esbuild options ... ignored`, then `Failed to resolve import "react/jsx-dev-runtime"`. Explicit `vite@7.3.5` makes the requested config work. A Vite 8 migration instead needs its JSX/OXC config; that alternative was not tested. Do not copy the requested esbuild config into an unpinned fresh Vitest 4 install and assume it selects zudo-react.

## (f) PARTIAL — wind grammar has explicit unsupported cases and replacements

Commands: `pnpm exec zfb wind explain --stdin --config preview/zfb.config.ts < evidence/candidates.txt` and same command with `--json`. Complete text **and versioned JSON** in [wind-explain.txt](wind-explain.txt). Config declares `md: { minWidthPx: 768 }` and `sm: { minWidthPx: 640 }`. Output identifies spec 1 revision 14.

| Candidate/family | Observed result / migration |
| --- | --- |
| `md:grid-cols-2`, `max-sm:grid-cols-2` | Resolved; `(min-width: 768px)` / `(width < 640px)`. |
| `group/nav`, `group-hover/nav:*` | ZW004 named markers/relation variants unsupported. Unnamed `group-hover:bg-accent` resolves, but loses named-group isolation; use an authored class/selector where nesting matters. |
| `group-data-[current=true]:*` | ZW004 attribute variants unsupported; author the data-attribute selector in CSS. |
| `peer-checked:*` | Resolved `:where(.peer:checked) ~ ...`. |
| `[&>ul]:mt-vsp-xs`, `[&:not(:first-child)]:before:content-['']` | ZW004 arbitrary selectors unsupported; authored CSS selector + declaration. |
| `open:*`, `marker:*`, `placeholder:*` | Resolved `[open]` / `:popover-open`, `::marker`, `::placeholder`. |
| `before:content-['']` | ZW014 foreign utility; author `::before { content: ""; }`. |
| `grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]` | Resolved verbatim. |
| `w-[min(calc(100vw-2rem),72rem)]` | ZW005; `w-[min(calc(100vw_-_2rem),72rem)]` resolves. CSS math needs spaces, encoded with underscores. |
| `shadow-[0_8px_24px_color-mix(in_srgb,black_20%,transparent)]` | Resolved; underscores become spaces. |
| `transition-[width,opacity,margin]` | Resolved; duration 150ms, timing ease defaults. |
| `flex-[2_1_0%]` | ZW005 unsupported arbitrary flex shorthand. `grow-[2]` and `shrink-[1]` resolve, but `basis-[0%]` is ZW014 foreign vocabulary; author `flex: 2 1 0%` to retain the complete shorthand. |
| `sr-only` | Resolved complete accessible hiding rule. |
| `bg-overlay/60` | Resolved `color-mix(in oklab, var(--zw-color-overlay) 60%, transparent)`. |
| `text-[color:var(--sg-fg)]` | ZW005 type hints unsupported; `text-[var(--sg-fg)]` is also ZW005 (`value is ambiguous across catalog entries`); author `color: var(--sg-fg)` or introduce an explicit color token. |
| `bg-[var(--sg-role)]` | Resolved, category unverified. |

Reserve authored legacy class names with `wind.authoredClasses` if retaining their spelling, or rename them to semantic classes. Diagnostics explicitly recommend this for `content`. Unverified variable values compile but are not a runtime guarantee about the variable's CSS type.

## (g) PASS — apps/demo exports survive with zudo-react child types

Command: `node --input-type=module` import/export probe ([exports.txt](exports.txt)); `cat`/`rg -n` installed declarations ([declarations.txt](declarations.txt)).

```ts
// @takazudo/zfb/dist/index.d.ts
export { /* ... */ defaultComponents, mergeMdxComponents, /* ... */ type MdxComponents } from "./content.js";
// @takazudo/zfb-runtime/dist/index.d.ts
export { ClientRouter, type ClientRouterProps } from "./client-router-component.js";
// @takazudo/zfb-runtime/dist/client-router/events.d.ts
export declare const TRANSITION_BEFORE_PREPARATION = "zfb:before-preparation";
export declare const TRANSITION_AFTER_SWAP = "zfb:after-swap";
export declare const TRANSITION_NAVIGATION_ABORTED = "zfb:navigation-aborted";
// @takazudo/zfb/dist/island.d.ts
persist?: string;
persistProps?: boolean;
```

Runtime output confirms `ClientRouter: function`, the three exact constant strings, and `client-router side-effect subpath import: PASS`. `@takazudo/zfb-runtime/client-router` is exported to `dist/client-router/index.js`, explicitly listed under package `sideEffects`; the side-effect entry remains usable. `MdxComponents` is a type export, not a runtime value. `Island` children/fallback now use zudo-react `Description`/`Child`; Preact VNodes do not satisfy the new rendering contract.

## (h) PASS — zudo-doc 6 host contract retained, renderer contract changed

Command: `cat node_modules/@takazudo/zudo-doc/dist/{factory-context/index,chrome/index,doclayout/doc-layout-with-defaults,header-with-defaults/index,footer-with-defaults/index,sidebar-tree-island/index,chrome-bindings,doc-history-area/index}.d.ts`; quoted, numbered excerpts in [declarations.txt](declarations.txt). Runtime proof of `defineChromeBindings` + virtual re-export is (d), and `zfb check` passes ([check.txt](check.txt)).

```ts
// factory-context
export type FactoryComponent = Component<Record<string, unknown>>;
docHistoryMeta?: Record<string, unknown>;
BodyEndIslands?: FactoryComponent;
// chrome
createChrome<S extends Settings = Settings>(context: RouteContext<S>, hostBindings?: ChromeHostBindings)
// DocLayoutWithDefaultsProps
children: Child;
headerOverride?: Child; sidebarOverride?: Child; tocOverride?: Child;
mobileTocOverride?: Child; breadcrumbOverride?: Child; footerOverride?: Child;
// returned HeaderWithDefaults takes HeaderWithDefaultsProps:
lang?: string; currentPath?: string; currentVersion?: string;
currentSlug?: string; navSection?: string; hideSidebarToggle?: boolean;
// returned FooterWithDefaults
(props: { lang?: string }) => Child
// SidebarTree
SidebarTree(props: SidebarTreeProps): import("@takazudo/zfb").Description;
// chrome-bindings
export declare function defineChromeBindings<T extends ChromeBindingsInput>(input: T & NoExtraKeys<T>): ChromeHostBindings;
// doc-history-area
export declare function DocHistoryBoundary({ ssrFallback, ...props }: Parameters<DocHistoryComponent>[0]): Description;
```

`docHistoryMeta` survives. `BodyEndIslands` host slot is broad `FactoryComponent`; the checked `BodyEndIslandsSlotProps` requires `basePath: string`, with optional `aiChatBodyLabel` and `forceImageEnlarge`. `SidebarTreeProps` requires `nodes: SidebarNavNode[]`; optional navigation/currentSlug/currentPath/root menu/locale/theme/date-format props remain. `DocHistoryComponent` props include server-only `ssrFallback?: Child`, required `slug`, optional locale/basePath/displayLocale/dateFormats. Use `DocHistoryBoundary` for the package client, so fallback stays server-side. `defineChromeBindings` checks exact per-slot props and rejects unknown keys before widening to `ChromeHostBindings`.

## (i) PASS — bootstrap export survives; overrides must be server boundaries

Command: `cat node_modules/@takazudo/zudo-doc/dist/design-token-panel-bootstrap.d.ts` + controller declarations + the real sixth Vitest test in (c/e).

```ts
export * from "./design-token-panel-bootstrap-controller.js";
export { DesignTokenPanelBootstrap } from "./design-token-panel-bootstrap-island.js";
// controller:
export declare function bootstrapDesignTokenPanel(buildConfig: PanelConfigBuilder): void;
// PanelConfigBuilder is (mode: "light" | "dark") => PanelConfig.
```

The `ChromeHostBindings.DesignTokenPanelBootstrap` declaration explicitly requires a **zero-prop server boundary** returning a Fragment with `Island({ when: "load", children: <HostBootstrap/> })`, where `HostBootstrap` is statically imported from a `"use client"` entry. A raw client component is not a boundary. Package chrome renders the supplied boundary unchanged rather than wrapping a dynamic target; it owns the designTokenPanel gate and toggle shim. An explicit host boundary wins over configured-route/package defaults. `DocHistory` has the corresponding fixed-target boundary rule. Do not move a client function through virtual binding data and expect scanner registration.

## (j) PASS — strict-peer result is explicit; MCP SDK is optional

Commands (empty `$HOME/.cache/zudo-sg-zfb4-spike/strict/`, `.npmrc`: `strict-peer-dependencies=true`, `auto-install-peers=false`):

```sh
# From this checkout's packages/styleguide (peer manifest only, unbuilt):
pnpm pack --pack-destination "$HOME/.cache/zudo-sg-zfb4-spike"
# In the empty strict project:
pnpm add ../takazudo-zudo-sg-0.4.1.tgz \
  @takazudo/zfb@4.3.1 @takazudo/zfb-md-wasm@4.3.1 \
  @takazudo/zfb-runtime@4.3.1 @takazudo/zudo-doc@6.0.0 @takazudo/zdtp@0.8.6 \
  diff@^8.0.4 katex@^0.16.38 preact@^10.29.8 \
  preact-render-to-string@^6.6.6 tailwindcss@^4.2.0 zod@^4.3.6
# pnpm add warns; enforce fresh resolution with strict install:
mv pnpm-lock.yaml first-lock.yaml
pnpm install --strict-peer-dependencies
```

Complete unmet-peer output ([strict-clean.txt](strict-clean.txt)):

```text
ERR_PNPM_PEER_DEP_ISSUES Unmet peer dependencies
@takazudo/zudo-sg 0.4.1
  ✕ unmet peer @takazudo/zfb@^2.20.3: found 4.3.1
  ✕ unmet peer @takazudo/zudo-doc@^5.27.0: found 6.0.0
```

These two engine peer ranges must change with the migration. There are **no other unmet lines**. After removing only the old engine from package.json and resolving afresh, strict family installation passes ([strict-family.txt](strict-family.txt)).

Published zudo-doc 6.0.0 declares `"@modelcontextprotocol/sdk": "1.32.1"` **and** `peerDependenciesMeta["@modelcontextprotocol/sdk"].optional: true`. Therefore omitting it is valid under strict peers; the requested probe must not invent a missing-peer error. A consumer enabling the MCP server must explicitly add `@modelcontextprotocol/sdk@1.32.1`. History-server is likewise optional, needed for doc history development service. Zdtp/md-wasm/katex/diff are optional zudo-doc peers, though the engine's zdtp peer and the documented install line provide relevant features. This probe does not certify old engine runtime compatibility; its tarball was deliberately not built or imported.

## Reproduction layout and limits

Copy snippets to the paths named above: `plugin.ts` / `adapter.ts` are the source text of the executed plain-JS package files (rename to `.js`; they contain no TS-only syntax), `Counter.tsx` / `Dashboard.tsx` to `route-package/client/`, `foo.tsx` to `route-package/routes-src/`. Write the object from `package-manifest.ts` as `route-package/package.json`, pack, install the tarball, and use `host.config.ts` as `zfb.config.ts`. Test fixtures copy Counter/Dashboard alongside `seams.test.tsx` under `tests/`; put `vitest.config.ts` at the host root. The scaffold supplies content and its TS configuration. Wind config files belong in `preview/`; card goes in `preview/components/`. Package metadata uses `.js` imports resolving to shipped `.tsx` source through zfb's compiler.

The tests and browsers validate API seams and basic behavior, not full styleguide migration, screenshot parity, route persistence across SPA navigations, dashboard nonempty token editing, or hot-recompile integration. CSS stamping requirements are recommendations grounded in the CLI input graph; a watcher implementation was not built. All findings are pinned to the recorded package versions.
