# Locked migration decisions (D1, issue 927)

Recorded 2026-10-11 on `base/zfb4-migration` at `9bfaf8664e6d9c41d6e90b78901f08c8dce0d53a`.
The runtime evidence is pinned to zfb/runtime/md-wasm 4.3.1, zudo-doc 6.0.0,
zdtp 0.8.6 and Preact 10.29.8. These decisions supersede the preliminary
alternatives and unsupported-syntax lists in downstream issues. No production
implementation or new visual result is claimed here.

## Decision matrix

| Decision | Choice | Rejected alternatives and reason | Evidence | Risk | PR-time review target |
| --- | --- | --- | --- | --- | --- |
| Preview CSS | Option A: retain independent `zfb css` compilation, URL/option and preview-root rescoping; preserve the middleware/build contract. | Option B: host stylesheet alone plus overrides works, but brings host reset/authored CSS into the preview contract and would retire an established foreign-host seam. A private programmatic compiler is not exported. | [Spike (a/b)](spike/findings.md), `spike/snippets/emitted-scoped.css`, baseline root preview state. | Spawn cost; stale config/source membership; host CSS is still injected by zfb and can collide. | E4 input invalidation/concurrent requests, F1 foreign base-path CSS proof, P1 iframe computed-style parity. |
| `/tokens` | Engine-owned opaque Preact adapter, dynamically loaded from a zudo-react island; server boundary and real loading fallback. Keep three real declared-default dashboards. | Direct Preact VNode in zudo-react fails the renderer boundary; gating `/tokens` violates scope; a public imperative dashboard API does not exist in 0.8.6. | [Spike (c/d/e)](spike/findings.md), `spike/snippets/adapter.ts`, `spike/manager-browser.txt`; upstream [zdtp issue 1032](https://github.com/Takazudo/zudo-design-token-panel/issues/1032). | Async completion after disposal, duplicated renderer, serialization of token props; empty-tabs spike did not prove populated dashboards. | E3 real nonempty `[data-css-var]` test; F1 packed dependency resolution; C2 tokens-dashboard navigation/lifecycle tests. |
| Breakpoints and variants | Declare sm 640, md 768, lg 1024, xl 1280; `strict: true`, `dark: false`, utilities `before-authored`; retain proven supported variants, replace unsupported ones below with authored `zc-`/`sg-` classes. | Removing md changes the 800px layout. Blanket rewrites of all max/peer/open/marker/opacity variants discard syntax proven supported. `strict: false` hides missed ports. Default after-authored reverses equal-specificity authored overrides. | [Spike (b/f)](spike/findings.md), `spike/wind-explain.txt`, `spike/manager-wind.txt`, `baseline/states.json`. | Unlayered utilities still outrank layered authored rules; transform composition and nested navigation state need care. | S3b token map/cascade; U1–U6 class coverage; H1/A1 wind audits; P1 390/800/1280 light/dark comparisons. |
| Engine chrome tokens | Declare all eleven `sg-*` wind colors as `var(--sg-*)` in `withZudoSg`; use `bg-sg-*`, `text-sg-*`, `border-sg-*`, `outline-sg-*`. | Keep brackets: background brackets compile, but `text-[color:var(...)]` fails and untyped text variables are ambiguous. Moving chrome to host colors loses namespace independence. | [Spike (f)](spike/findings.md), `packages/styleguide/scripts/check-chrome-tokens.mjs:CHROME_ROLES`. | Merge order can overwrite host token categories; manifest must use identical engine defaults. | E1–E4 owning-file replacements, E4 lint/config tests, H1/F1 foreign tokens and thumbnail scope. |
| Test harness | Typed public-API wrappers in both packages; Vitest 4.1.11 + Vite 7.3.5; hydrate by default, diagnostics fail, explicit dispose; U6 alone reviews/re-pins 83 source-drift snapshots once. | Unpinned Vite 8 ignores the specified esbuild JSX settings. Preact test helpers cannot test zudo-react hydration. Blanket snapshot update or suppressing diagnostics hides regressions. | [Spike (e)](spike/findings.md), `spike/snippets/seams.test.tsx`, `spike/vitest.txt`. | Small query helpers must not silently emulate an incomplete accessible-name algorithm; async widget work needs explicit waiting. | S3c positive/negative lifecycle tests, E1–E3 and U1–U6 migrated tests, U6 categorized snapshot diff. |
| Story reactivity | `Story.render(args)` executes once per mounted story scope; accepted controls/variant updates remount a keyed story child; local story state resets intentionally. | Calling the story again in an outer reactive expression can retain/leak its setup scope; pretending mutable props are reactive preserves stale output. | zudo-react setup-once contract, spike Counter lifecycle in (e), issue 932 protocol and existing `PreviewApp` ownership. No dedicated remount spike was run. | Listener/observer leaks, iframe receiver duplication, unnecessary theme remounts. | E2 repeated updates and variant switches prove setup/dispose counts and fresh state; theme-only changes preserve story state. |

## Preview compiler contract — E4, S3b, F1

- `packages/styleguide/src/config/index.ts:withZudoSg()` remains pure data, with
  no Node imports. Forward the composed host wind data plus `componentsRoots`
  to `src/plugins/preview-css.ts`. Do not import the full host config from the
  generated child config: that would instantiate the site/plugins recursively.
- `src/preview-css/compile.ts:compilePreviewCss()` invokes the **host-installed**
  zfb CLI with argument-array spawning (no shell interpolation):
  `zfb css --input <absolute previewStyles> --output <unique temp CSS> --config <generated config> --project-root <host root> --source <component root/glob> --no-auto-source`.
  Repeat `--source` per component root. Resolve the host's package CLI, without
  `dlx`, a registry fetch, or an assumed global binary. No invented `--watch` or
  `--minify` flags. CLI help was re-read during D1 and matches spike (a).
- Write an ephemeral `.zudo-sg-preview-<nonce>.config.ts` beside the host config
  (host project root), containing only `export default { wind: <plain data> }`.
  Keeping that directory preserves the host anchor for relative token manifests
  and source paths. Clean the config and temporary output in `finally`, including
  compiler failure. Exclude the generated files from source stamps/scanning.
  The snapshot copies the resolved wind tokens, reset, breakpoints, dark policy,
  strictness, placement, manifests, safelist, authoredClasses and source controls;
  no plugin, route, collection or bundle options enter it. `previewStyles` is the
  independent CSS input, never an import of the host global stylesheet.
- `--no-auto-source` disables default roots only; preserve explicit host
  `wind.sources` and manifests as well as component `--source` arguments. Do not
  rely on that flag to disable configured sources. `componentsRoots` is optional
  in descriptor mode: zero source flags is valid and authored CSS still compiles.
- `scopeTokensToPreviewDoc()` must rewrite selector `:root` nodes to
  `:root[data-sg-preview-doc]`, including generated `--zw-*` roots and authored
  token roots, without changing comments, strings, declaration values, or
  duplicating an existing attribute. Use a selector-aware transformation; retain
  PostCSS if needed. Do not unlayer/reset all CSS as a shortcut. zfb still injects
  the host stylesheet: verify preview variable resolution, not total isolation.
- Keep `previewStyles`, `previewCssUrl` and default `/_zudo-sg/preview.css`.
  `previewCssRoute()` prepends the host base exactly once;
  `previewCssOutputPath()` writes `<outDir>/_zudo-sg/preview.css` without the base
  segment. Preserve GET/HEAD, `text/css`, `no-store`, 405 and 500 behavior. A failed
  compile does not serve stale success. Post-build output uses temp + atomic rename.
- Replace `computeStamp`/`watchedPaths`' mtime-only freshness with a deterministic
  content stamp: entry and recursively imported CSS; host config and its imported
  token/config inputs; resolved wind data; manifest files; compiler version;
  project root and source flags; sorted matched source paths **and contents**.
  Re-enumerate roots each check so initially empty directories, nested additions,
  deletions and renames invalidate. Never stamp output. Keep one inflight compile,
  compare pre/post stamps, and invalidate again if inputs changed during compile.
  Configuration edits must use fresh resolved data (zfb config reload/restart is
  acceptable); recompiling with a stale captured wind object is not. Tests must
  distinguish this restart boundary from CSS/source edits needing no restart.
- S3b `src/styles/preview-entry.css` imports demo-ui tokens, colors and
  `styles/components.css`, preceded by `@layer zw-reset;`. F1 fixtures use their
  own tokens/authored component sheets; never depend on demo-ui to install engine.
  `scripts/verify-styleguide-install.mjs` retains its disk-output assertion and
  checks a real emitted preview utility, scoped roots, import/source-edit updates,
  and non-root-base serving. Manager-owned verify runs execute these checks.

## Dashboard boundary — E1, E3, S3a, H1, F1

The missing public mount API is tracked by
[upstream issue 1032](https://github.com/Takazudo/zudo-design-token-panel/issues/1032),
filed via the bundled `dev-upstream-report` instructions using public package
terms. This is an additive API request; 0.8.6's Preact dashboard contract remains
valid. The current migration does not wait for an upstream release.

- S3a declares `preact: ^10.29.1` as an engine **regular dependency** in
  `packages/styleguide/package.json`, resolved/deduplicated with zdtp's compatible
  range (spike resolved 10.29.8). Remove the old engine Preact peer and all host,
  demo-ui and fixture direct Preact requirements. Exactly one resolution is the
  target, now shared by **engine adapter and zdtp**, not only zdtp. zdtp's private
  Tailwind dependencies remain package-owned and do not constitute a host port.
- E3 keeps `create-token-dashboards.tsx:createTokenDashboards()` server-safe.
  Add `token-dashboard-mount.tsx` (`"use client"`, island export
  `TokenDashboardMount` only) and `token-dashboard-adapter.ts` (ordinary module,
  `mountDashboard(host: HTMLElement, props: TokenDashboardProps): () => void`).
  Adapter uses `h`/`render` from `preact` and `TokenDashboard` from the public
  dashboard leaf; `render(h(TokenDashboard, props), host)` returns cleanup
  `() => render(null, host)`. Do not pass its VNode into zudo-react or the server.
- `createTokenDashboards()` owns statically imported `<Island when="load">`
  boundaries, with truthful heading/loading `ssrFallback`, for the three existing
  IDs `ui-defaults-light`, `ui-defaults-dark`, `ui-defaults-shared`. Preserve each
  `mode`, `chrome`, `include`, title, tabs, preview overrides and preview text.
  Pass only serializable data across Island props; if any derived config has
  functions, derive those inside the island from a serialized manifest instead.
  Do not send callbacks, Preact nodes or component functions over the boundary.
- `TokenDashboardMount` returns an empty `<div data-sg-token-dashboard ref={ref}>`.
  Capture `getScope()` during setup. `onActivate` lazily imports the adapter and
  registers synchronous cleanup with an alive/aborted guard. Late resolve must
  do nothing after disposal; reject is caught and gives a visible failure state.
  Cleanup calls the Preact unmount before clearing the host. Normal zudo-react
  rerenders never own the opaque div's children.
- Keep dashboard CSS in the host stylesheet pipeline as
  `@import "@takazudo/zdtp/dashboard/styles.css";` (root and F1 fixture/template).
  E1's `src/routes/tokens.tsx` calls the server helper; it must not turn `/tokens`
  off. H1 keeps its declared-default data and root CSS wiring.
- E3 tests real **nonempty** tokens and `[data-css-var]` values, disposal and late
  import cancellation. Spike only proved empty tabs; no happy-dom limitation is
  established and no smoke-only waiver is granted. F1 proves host/engine/zdtp
  Preact resolution and one bundled renderer from a packed install; C2 checks
  real dashboards and repeated navigation. These dashboards show declared
  defaults and are not editable panels; panel interaction is a separate test.

## Shared wind rules and exact migrations

`packages/demo-ui/styles/wind-tokens.mjs:demoUiWindBreakpoints` is exactly
`{ sm: { minWidthPx: 640 }, md: { minWidthPx: 768 }, lg: { minWidthPx: 1024 }, xl: { minWidthPx: 1280 } }`.
Use this map in root and demo; foreign fixtures declare equivalent needed
breakpoints locally. All applicable wind configs use `strict: true`,
`dark: false`, `reset: "owned-v1"`,
`utilities: { placement: "before-authored" }`. Keep light/dark variable semantics
and current `data-theme` behavior. During the intentional red window strict
errors are port work, not a reason to disable strictness.

Generated utilities are unlayered even with this placement. New authored
replacement rules in category CSS are unlayered too; do not put them in a lower
priority `components` layer and expect source order to beat utilities. Existing
intentional prose/doc layers need computed-style comparison before changes.
Reference guidance read: CSS wisdom `architecture/cascade-layers.mdx` and
`selectors/parent-state-child-styling.mdx`.

Root sources below root go in `sources.roots`. In `apps/demo` use
`sources.packageRoots: ["@zudo-sg/demo-ui"]` for the installed workspace package,
not an outside-root `../../packages/demo-ui/src` in `sources.roots`. Keep existing
local roots and register `cx`/`cn` in `sources.classHelpers` when used for class
lists. Config schemas are evidenced by installed 4.3.1 `dist/config.d.ts`.

| Current idiom | Locked replacement or retention |
| --- | --- |
| `md:*` | Keep with declared 768px breakpoint. |
| `max-sm:*` | Keep: spike resolves `(width < 640px)`. This supersedes preliminary blanket rewrite instructions in U1/U3/A1. Equivalent authored fallback, only if a specific candidate fails, is `@media (width < 640px) { .zc-<component>-<state> { <same declaration> } }`; do not change it to 639px. |
| `group/ctx`, `group-hover/ctx:*`, `group-focus-within/ctx:*` | U3 `site-header.tsx`: owner `zc-context-switcher`, arrow `zc-context-switcher-arrow`; remove named variant strings. `.zc-context-switcher:is(:hover, :focus-within) .zc-context-switcher-arrow { rotate: 180deg; }`; `.zc-context-switcher:is(:hover, :focus-within) > [data-ctx-panel] { visibility: visible; pointer-events: auto; opacity: 1; translate: -50% 0; }`. Move that panel's base x/y translate utilities to `#zui-ctx-panel` via `[data-ctx-panel] { translate: -50% -6px; }` scoped beneath `.zc-context-switcher`, so x centering survives state changes. Keep the enhancer's pinned inline translate behavior consistent and test hover/focus/pinned open. `group/search` becomes `zc-header-search` without inventing hover behavior; update comments/selectors in both enhancers. |
| `group-data-[current=true]:*` and navigation `group-open:*` | U3 `site-nav.tsx:SUMMARY_CLASS/SectionSummary`: add `zc-nav-summary`/`zc-nav-chevron`. `details[data-nav-item]:is([data-current="true"], [open]) > .zc-nav-summary { border-inline-start-color: var(--color-accent); background-color: var(--color-rail-hover-bg); color: var(--color-rail-fg); }`; same parent path `> .zc-nav-summary .zc-nav-chevron { color: var(--color-rail-fg); }`; only `[open] > .zc-nav-summary .zc-nav-chevron { rotate: 90deg; }`. Scope the last rule to `details[data-nav-item]`; preserve all existing hooks. Direct-child summary prevents a parent's state styling a nested section's summary. |
| `peer-*` | Keep spike-proven `peer-checked:*`; resolve other used variants (especially `peer-focus-visible:*` and `max-sm:peer-checked:*`) with the actual root config. If a candidate fails, U3 uses the existing sibling structure: `#zui-nav-toggle:checked ~ .zc-nav-overlay { pointer-events: auto; opacity: 1; }`; under `(width < 640px)`, `#zui-nav-toggle:checked ~ #zui-nav-drawer { visibility: visible; translate: 0 0; }`; `#zui-nav-toggle:focus-visible ~ .zc-nav-mobile-bar { outline: 2px solid var(--color-rail-fg); outline-offset: -2px; }`. Replace only failed candidates, retain base transform composition and unrelated selectors. |
| `[&_p]:mb-vsp-xs` | U2 `prose-blockquote.tsx` adds `zc-prose-blockquote`; `content/content.css`: `.zc-prose-blockquote p { margin-bottom: var(--spacing-vsp-xs); }`. |
| `[&>ul]:mt-vsp-xs [&>ul]:mb-0 [&>ol]:mt-vsp-xs [&>ol]:mb-0` | U2 `prose-li.tsx` adds `zc-prose-li`; `.zc-prose-li > :is(ul, ol) { margin-top: var(--spacing-vsp-xs); margin-bottom: 0; }`. |
| `[&:not(:first-child)]:before:text-border` / `before:content-['/']` | U3 `breadcrumbs.tsx` adds `zc-breadcrumb-item`; `.zc-breadcrumb-item:not(:first-child)::before { content: "/"; color: var(--color-border); }`. Preserve gap/alignment and other existing declarations. |
| `before:content-['—']` | U1 `product-category-grid.tsx` adds `zc-product-category-item`; `landing.css`: `.zc-product-category-item::before { content: "—"; }`. Keep supported before color/margin utilities. |
| `before:content-[''] after:content-['']` | U3 hamburger span adds `zc-nav-toggle-icon`; `.zc-nav-toggle-icon::before, .zc-nav-toggle-icon::after { content: ""; }`. Keep existing bar geometry/color utilities if explain resolves them. |
| `open:*`, `marker:*`, `placeholder:*` | Keep resolved variants, including `marker:text-muted`. For an actually failing declaration use `.zc-<component>[open]` (details), `.zc-<component>:popover-open` (popover), `.zc-<component>::marker { color: var(--color-muted); }`, or `.zc-<component>::placeholder` respectively. No blanket replacement. |
| Color opacity e.g. `bg-overlay/60` | Keep; wind emits `color-mix(in oklab, var(--zw-color-overlay) 60%, transparent)`. If authoring the equivalent, preserve `oklab` and percentage; do not silently replace existing explicit `in_srgb` expressions. |
| `text-[color:var(--sg-ROLE)]`, `text-[var(--sg-ROLE)]`, `bg-[var(--sg-ROLE)]` | Engine owners replace with `text-sg-ROLE` / `bg-sg-ROLE`; likewise border/outline, preserving supported hover/focus variants. Full role list below. Other ambiguous text var colors need a declared color token or authored `.sg-... { color: var(...); }`. Do not strip `color:` and assume it resolved. |
| `w-[min(calc(100vw-2rem),72rem)]` and CSS math | U3 use `w-[min(calc(100vw_-_2rem),72rem)]`; fix the context panel's `max-h-[min(32rem,calc(100dvh-4rem))]` to `max-h-[min(32rem,calc(100dvh_-_4rem))]`. Preserve literal values; underscore separates math operators. |
| `md:flex-[N_1_0%]` | U5 `split-layout.tsx:RATIO_CLASS`: `zc-split-grow-1/2/3`; in `shared.css` `@media (min-width: 768px)` each class gets `flex: 1 1 0%`, `flex: 2 1 0%`, `flex: 3 1 0%` respectively. Keep `md:flex-1` for 50/50 if it resolves. A1 `<main>`'s `flex-[1_0_auto]` becomes `zc-demo-main { flex: 1 0 auto; }` in `styles/content.css`. Partial grow/shrink replacements would lose basis. |
| Other supported arbitrary values | Keep spike-proven auto-fit grid, shadow, transition and `sr-only`; each unproven candidate gets `zfb wind explain`, not a guessed translation. Dynamic `max-w-[${n}ch]` becomes an explicit style width bound or a finite literal set in U5/U6. |

New authored component names start `zc-` in demo-ui (and demo app), `sg-` in
engine chrome. Retain existing hook names. A necessary legacy name colliding
with a utility root, such as `content`, must be explicitly reserved via
`wind.authoredClasses: { content: true }` with a real corresponding selector;
never reserve unsupported utilities merely to hide diagnostics.

## Engine token map and ownership

E4 `src/config/index.ts:withZudoSg()` and its manifest config share the eleven
color keys `sg-bg`, `sg-fg`, `sg-surface`, `sg-surface-2`, `sg-border`,
`sg-border-strong`, `sg-muted`, `sg-accent`, `sg-on-accent`, `sg-focus`, `sg-success`.
Each value points to its same-named `--sg-*` variable. Deep merge token categories
(engine defaults first, explicit host entries last), keep unrelated host wind
keys, and register `wind.manifests["zudo-sg"]` using the public `wind.json` export.
Tests prove explicit host overrides and engine default availability together.

E1 updates its catalog/chrome/routes files, E2 preview/search, E3 code-panel/
token-tweak/dashboard; E4 updates the guard, config and manifest rather than
editing another concurrent owner's file. Preserve the existing explicit
host-boundary exceptions in `check-chrome-tokens.mjs` (preview canvas and header
trigger). Root thumbnail variable remapping and preview-root contract stay.
F1 proves engine-only candidates come from the manifest without host safelists.

Manifest CLI (D1 `--help` verified): run from engine root with
`--project-root . --config scripts/wind-manifest.config.ts`,
`--producer zudo-sg --output dist/wind.json --source 'dist/**/*.js' --source 'routes-src/*.tsx' --no-auto-source`.
The config-relative directory is `scripts/`; project-root/source flags must be
explicit so scans do not accidentally target `scripts/dist`. CLI JSON schema
checks must inspect actual emitted schema, not assume a report and manifest
have the same structure.

## Shared helper contract — S3c and consumers

Both `packages/demo-ui/src/test-utils/zudo-react.ts` and
`packages/styleguide/src/__tests__/helpers/zudo-react.ts` expose the same API:

```ts
renderSsr(node: Child, context?: IslandTestContextOptions): string;
renderIsland<P extends Record<string, unknown>>(
  Component: Component<P>, props: P,
  options?: {
    mode?: "hydrate" | "mount";
    identity?: IslandIdentity;
    allowDiagnostics?: boolean;
    beforeActivate?: (test: IslandTest) => void;
  },
): {
  container: Element;
  html: string;
  diagnostics: Diagnostic[];
  flush(): Promise<void>;
  dispose(): void;
};
flushAll(): Promise<void>;
disposeAll(): void;
fire(target: Element, type: string, init?: EventInit & Record<string, unknown>): boolean;
getByText(root: ParentNode, text: string | RegExp): HTMLElement;
queryByText(root: ParentNode, text: string | RegExp): HTMLElement | null;
getByRole(root: ParentNode, role: string, options?: { name?: string | RegExp }): HTMLElement;
queryAllByRole(root: ParentNode, role: string, options?: { name?: string | RegExp }): HTMLElement[];
```

Use public `renderToString`, `createIslandTest`, `withIslandTestContext` and
`flush`. `renderSsr` wraps with the context only when full-page Island scanner
metadata is needed. `renderIsland` calls `createIslandTest(..., { document,
...defined identity })`, optionally runs `beforeActivate`, then hydrates by
default or mounts explicitly; container is `test.host`, html is the original
SSR string. The optional preactivation hook permits a real mismatch test.
It is not a raw-HTML renderer or an arbitrary existing-container hydration API.
Enhancer tests use a tiny wrapper component containing both SSR markup and the
render-null enhancer; scope fixtures to that connected test host.

Any diagnostic, including preflight mismatch, fails immediately after activation,
after each `flush()`/`flushAll()`, and at disposal/`afterEach(disposeAll)`. Explicit
`allowDiagnostics: true` is restricted to negative diagnostic tests. Always clean
up even when assertion fails; dispose all registered hosts before reporting a
collected error. Do not leak a newly created test when activation throws.

`fire` uses `MouseEvent` for click/mouse, `KeyboardEvent` for keys, `InputEvent`
where needed and `Event` otherwise, with bubbling by default; it does not flush
automatically. Queries require an explicit root; no global Preact `screen`.
`get*` throws on zero/multiple matches, `query*` follows its name. Cover the
native roles/labels actually used (button, link, textbox, checkbox, radio,
combobox and explicit role; `aria-label`/`aria-labelledby`/label text where
applicable); document any unsupported query and use direct DOM selectors
instead of silently misidentifying it. Do not substitute arbitrary text content
for an accessible name when a label exists.

S3a pins Vite **7.3.5** for the Vitest configs using
`esbuild: { jsx: "automatic", jsxImportSource: "@takazudo/zfb/zudo-react" }`
and pins Vitest **4.1.11**; maxWorkers 2, happy-dom and jest-dom retained.
F1's generated fixture test harness uses the same versions/transform and public
APIs, not private helpers. Async imports/markdown need bounded `vi.waitFor` in
addition to flush; a scheduler flush does not promise completion of arbitrary IO.
U1–U5 do not change source-drift snapshots. U6 reviews all 83 once, allowing only
serializer differences and named reviewed migration deviations; structural,
content, accessibility, style-value and lifecycle changes are regressions until
explained/fixed. Keep counts and attach the delta-category summary.

## Story remount contract — E2

`src/preview/preview-app.tsx:PreviewApp` uses a version signal and a keyed
one-item `For` that creates a child wrapper; that wrapper invokes
`story.render(snapshotArgs)` within its own setup scope. Accepted
`sg:updateProps` and actual slug/variant changes create a new key after updating
args. Dispose the previous subtree before mounting the next. Do not use a
bare JSX `key` or a reused constant key and expect setup to run again.

Only the story subtree remounts. The outer iframe receiver, protocol v1,
ready/height lifecycle and token-panel registry persist. `sg:setTheme` only
updates `documentElement.dataset.theme`; it does not remount the story.
Test two successive prop updates and a variant change with setup/cleanup
counters, visible values and local state, then dispose; prove no duplicate
listeners, observers or timers and preserve origin/source checks. Confirmed
policy, with dedicated implementation proof assigned to E2 (not claimed by D1).

## Downstream issue coverage and validation

Appended one `## Locked decisions (D1)` section to issues 928, 929, 930, 931,
932, 933, 934, 936, 937, 938, 939, 940, 941, 942, 943 and 944. S3a (928) is
included because it owns the lockfile: its old remove-all-Preact instruction
must include the engine adapter exception and the tested Vite pin. Every
required E1–E4/S3b/S3c/U1–U6/H1/A1/F1 issue is covered. Scheduling marker lines
and all original body text are retained; the appended locked section explicitly
supersedes conflicting preliminary instructions. No downstream task is
unnecessary, so no `**SKIP:**` marker was added. Epic/tracker 924 was not edited.

D1 checks are document/link/API consistency, byte-for-byte original-body and
scheduling-marker preservation, complete section coverage, and read-back of
GitHub edits. No production code, tests, builds, installs, servers or browser
runs were needed for this decision-only change. Baseline `states.json` remains
14 states × 3 viewports × 2 themes = 84 image/style pairs; the screenshots are
future comparison targets, not new visual verification. Browser and heavy
verification remain with the coordinating gates.
