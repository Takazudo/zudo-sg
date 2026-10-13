# `@takazudo/zudo-sg`

The zudo-sg **styleguide engine** — an installable package that gives a
[`@takazudo/zfb`](https://www.npmjs.com/package/@takazudo/zfb) +
[`@takazudo/zudo-doc`](https://www.npmjs.com/package/@takazudo/zudo-doc) host
a component catalog, story registry, preview iframe, code panel, and design
token dashboards, built and shipped the same way `@takazudo/zudo-doc` itself
is. This repository ([`Takazudo/zudo-sg`](https://github.com/Takazudo/zudo-sg))
dogfoods the engine as its own styleguide host — see
`docs/adr/styleguide-engine.md` there for the full seam contract.

## What it gives a host

- Package-owned routes — `/components`, `/components/[slug]`,
  `/components/preview`, `/tokens` — injected into the host's zfb build via
  `@takazudo/zudo-sg/plugins/routes` (mirrors `@takazudo/zudo-doc`'s own
  route-injection seam).
- A `zudo-sg` CLI: `gen-registry [--check]`, `new-component <name> --category
  <c> [--nested] [--skip-barrel]`, `gen-token-manifest [--check]`, all driven
  by a host `zudo-sg.config.mjs`.
- A story-authoring contract (`@takazudo/zudo-sg/stories`): `StoryMeta`,
  `Story<P>`, `StoryControl<P>`, `StoryModule`, `defineStory`. Categories are
  open, host-ordered data (`categoryOrder: string[]`), never a closed type.
- A standalone preview stylesheet compiler
  (`@takazudo/zudo-sg/plugins/preview-css`) that invokes the host-installed
  `zfb css` command with the composed wind config and component sources, then
  scopes the output under `:root[data-sg-preview-doc]` so it coexists with the
  host's global stylesheet.
- Generated wind manifest and chrome styles (`@takazudo/zudo-sg/wind.json`,
  `@takazudo/zudo-sg/styles.css`) so zfb includes the catalog's utility
  candidates without depending on the host's source scan.
- Token dashboards and a preview design-token panel, driven by a
  `gen-token-manifest`-produced manifest.

## Host-owned token vocabulary

`tokens.spec` is optional. Without it, `gen-token-manifest` keeps the historical
UI token vocabulary and the five legacy arrays. With it, the supplied spec
**replaces** that vocabulary: omitted categories produce no rows. Each category
(`palette`, `color`, `spacing`, `font`, `size`) is an ordered array of groups;
each group has `id`, `label`, `tokens`, and optional `preview` / `previewBase`.
Every token names a declared `cssVar`; optional `id`, `label`, `control`, `step`,
`unit`, `units`, `options`, `readonly`, `pill`, `note`, and `valueKind: "number"`
provide metadata. `note` stays in the generated module; zdtp has no per-row
note field, so it is not displayed in the panel. The generated module still exports the five familiar
arrays, plus `UI_TOKEN_GROUPS` for custom specs. The engine's injected `/tokens`
route and preview panel consume the same groups. Existing five-array modules
remain valid without metadata.

```js
// zudo-sg.config.mjs — CSS files must declare every listed variable.
tokens: {
  cssFiles: ["./src/styles/tokens.css", "./src/styles/colors.css"],
  manifestOut: "./src/styleguide/token-manifest.ts",
  spec: {
    palette: [{ id: "brand", label: "Brand", tokens: [
      { cssVar: "--brand-100" }, { cssVar: "--brand-500", readonly: true },
    ] }],
    color: [{ id: "surface", label: "Surfaces", tokens: [
      { cssVar: "--surface-canvas", control: "text" },
    ] }],
    spacing: [{ id: "inset", label: "Inset", preview: "bar", tokens: [
      { cssVar: "--space-inline", step: 0.125, unit: "rem", units: ["rem", "px"] },
    ] }],
    font: [{ id: "leading", label: "Leading", preview: "line-height",
      previewBase: "--type-body", tokens: [
        { cssVar: "--type-leading", valueKind: "number", step: 0.1 },
      ] }],
    size: [{ id: "corners", label: "Corners", preview: "radius", tokens: [
      { cssVar: "--corner-card", step: 0.125, unit: "rem" },
    ] }],
  },
},
```

The supported preview/kind pairs are `size`, `bar`, and `radius` with lengths;
`line-height` with numbers; `family` with text; `weight` with select options or
unitless numbers; and `duration` with `ms`/`s` lengths or numbers. `previewBase`
requires `line-height` and an existing CSS variable. Omit preview for ordinary
rows. Palette colors use their explicit CSS names, including sparse ramps and
unrelated prefixes; custom groups use generic panel tabs. Values such as
`light-dark()` and `var()` remain raw CSS expressions in the manifest.

The parser reads literal custom-property declarations in the configured CSS
files. It does not follow CSS imports or evaluate expressions. Conflicting
repeat declarations, invalid or duplicate effective IDs/names, unsupported
preview/control combinations, and missing references fail generation before
writing output. Run `pnpm gen-token-manifest` after changing CSS or the spec,
then `pnpm gen-token-manifest --check` in CI. The complete foreign configuration lives in `fixtures/foreign-tokens/`. The packed foreign-host
proof is `node scripts/verify-styleguide-install.mjs` from
this repository (a guarded heavy check). It installs the packed tarball with
pinned peers outside the workspace, builds at `/styleguide/`, checks the
default, custom-collision, and outside-namespace configurations, and runs
browser checks for early preview-panel clicks plus the rendered identity
inside detail-page iframes.

## Framework scope

Module-mode stories use zfb's zudo-react runtime. Hosts using another
framework can use descriptor mode with an external preview document; see the
ADR's "Framework scope" decision. The `/tokens` dashboard is the one renderer
exception: its opaque adapter mounts zdtp's Preact widget internally, with
Preact installed as an engine dependency rather than a host peer.

## Quick start with the initializer

For a new host, use the pnpm initializer:

```sh
pnpm create zudo-sg@latest my-styleguide
cd my-styleguide
pnpm install
pnpm gen-registry
pnpm gen-token-manifest
pnpm dev
```

It copies a private starter with three example zudo-react components, stories,
token CSS, a preview entry, and the zfb/zudo-doc composition already wired.
The CLI prints the same next steps after scaffolding.

`new-component` emits stories that import their `StoryMeta` and `Story` types
from `@takazudo/zudo-sg/stories`. Generated components compose their classes
locally, so a host does not need to add a demo-specific `cx` helper.

`gen-registry` bootstraps a missing or whitespace-only `registryOut` and its
parent directories, so a new host does not need to create a marker-only seed
file by hand. A non-empty registry without generated markers is rejected to
protect hand-authored content. `gen-registry --check` reports missing or empty
output as drift and never writes it.

## Installation

```sh
pnpm add @takazudo/zudo-sg@latest @takazudo/zfb@^4.4.0 @takazudo/zfb-md-wasm@^4.4.0 @takazudo/zfb-runtime@^4.4.0 @takazudo/zudo-doc@^6.1.1 @takazudo/zdtp@^0.8.6 diff@^8.0.4 katex@^0.16.38 zod@^4.3.6
```

The engine peers are `@takazudo/zfb ^4.4.0`, `@takazudo/zudo-doc ^6.1.1`,
and `@takazudo/zdtp ^0.8.6`. `@takazudo/zdtp` is required:
the injected `/tokens` route loads its dashboard through the engine-owned
opaque Preact adapter. Preact is a regular engine dependency, not a host peer. The
`@takazudo/zfb-md-wasm`, `@takazudo/zfb-runtime`, `diff`, `katex`, and `zod`
entries are prerequisites inherited from zfb/zudo-doc; zudo-doc's published
route dist imports `diff` and `katex` even when those features are disabled
(see [zudolab/zudo-doc#4206](https://github.com/zudolab/zudo-doc/issues/4206)).
The host renders components with zudo-react and compiles preview utilities with
zfb's zudo-wind compiler. The command above reproduces the full fixture
dependency set.

Keep the `tokens` block in `zudo-sg.config.mjs`: the initializer's config
typing treats it as required, and `gen-token-manifest` needs its two CSS paths
and `manifestOut` to populate the `/tokens` dashboards. Manual adopters should
also retain `@takazudo/zdtp`, `diff`, and `katex`; they are required host
dependencies, not optional extras.

## Recover highlighting in an existing consumer lock

An existing lock can retain two `@lezer/common` module identities even after
installing compatible engine/editor versions. The visible symptom is missing
TSX or editable CSS highlighting with a CodeMirror plugin error
`tags is not iterable` (the variable name can differ in a minified bundle);
successful editor construction or typing does not
establish that highlighting works.

From the affected host, diagnose and deduplicate its own graph:

```sh
pnpm dedupe --check
pnpm dedupe --ignore-scripts
pnpm install --frozen-lockfile
```

The first command is diagnostic and exits nonzero when deduplication is needed.
Review the resulting lock diff. Rebuild the host's generated output from scratch
(the packed proof removes only `dist` and `.zfb-build` before `pnpm exec zfb build`),
then verify TSX source tokens, editable CSS tokens, Live CSS application and
clearing, preview isolation, and absence of plugin/browser errors.
An ordinary or frozen install alone can preserve the split.

This recovery is scoped to pnpm **11.5.2**; other package managers need their own
resolution proof. It is consumer remediation, not a universal package-side fix.
Published compatible Lezer ranges still admit older common modules; direct
floors or a root-workspace dedupe check do not guarantee every retained consumer
lock. The separate packed diagnostic `pnpm verify:retained-lezer-lock` in the
engine repository preserves a clean control and treats the pre-recovery failure
as expected evidence. Track the remaining compatibility requirement in
[zudo-sg#963](https://github.com/Takazudo/zudo-sg/issues/963).

## Composing it into a host

```ts
import { defineConfig } from "zfb/config";
import { zudoDoc } from "@takazudo/zudo-doc/config";
import { withZudoSg } from "@takazudo/zudo-sg/config";

export default defineConfig(
  withZudoSg(
    zudoDoc({
      /* ... */
    }),
    {
      componentsRoots: [{ dir: "./src/components", importBase: "@/components" }],
      registryOut: "./src/styleguide/sg-registry.ts",
      uiPackageName: "@your-scope/ui", // optional: usage snippets and catalog labels
      previewStyles: "./src/styles/preview-entry.css",
    },
  ),
);
```

`withZudoSg` merges the engine's plugins and collections after the zudo-doc
preset's own. When the zudo-doc preset has an empty `headerNav`, it also adds
the engine-owned Components and Design Tokens links and the standard search
control. Any non-empty host navigation stays authoritative; set
`chromeDefaults: false` in the second argument to keep an intentionally empty
header. The engine requires `packageOwnedRoutes: true` on the host (its
routes import zudo-doc's route-context virtual modules). On the engine's zfb
peer floor (4.4.0) nothing else is needed: `zfb dev` seeds its island
scanner from the injected routes. `@takazudo/zudo-sg/islands` remains
exported as a side-effect module that statically imports every engine
island — importing it once from a host `pages/` file is optional and
harmless (it was required before zfb 2.18.0).

`uiPackageName` is optional. When set, it names the package used in generated
usage snippets and catalog labels; when omitted, scaffolded usage snippets
import the component from its own relative module. The generated registry's
`StoryModule` type always comes from `@takazudo/zudo-sg/stories`.

If a host calls `createRegistry()` directly, pass the same `routes` overrides
used by `withZudoSg()`. The default preview endpoint occupies the detail URL
for the slug `preview`, so a story titled “Preview” gets `preview-2`. Custom
preview endpoints within the detail route pattern are reserved the same way;
endpoints outside that pattern do not change story slugs.

Full option shape, virtual modules, and every locked constant:
`docs/adr/styleguide-engine.md` in this repository.

### Host styles

Add `src/styles/global.css` to the host; zfb discovers it automatically
(`styles/global.css` takes precedence if both exist). The initializer ships
this entry already. Use this import order, replacing `ui-tokens.css` with
your own token stylesheet as needed:

```css
@layer zw-reset, zd-flow;
@import "@takazudo/zudo-doc/theme.css";
@import "./ui-tokens.css";
/* Add your component package stylesheet here. */
@import "@takazudo/zudo-doc/content.css";
@import "@takazudo/zudo-doc/features.css";
@import "@takazudo/zudo-doc/page-loading.css";
@import "@takazudo/zdtp/dashboard/styles.css";
@import "@takazudo/zudo-sg/styles.css";
```

### Three token worlds and the engine override hook

The host contains three independent color-token worlds:

- zudo-doc's `--zd-*` roles style the documentation shell and doc chrome.
- zudo-sg's raw `--sg-*` roles style the catalog engine chrome.
- The host component library owns its own `:root` color tokens, usually the
  `--color-*` semantic roles used by previews.

The engine's eleven public chrome roles are `--sg-bg`, `--sg-fg`, `--sg-surface`,
`--sg-surface-2`, `--sg-border`, `--sg-border-strong`, `--sg-muted`, `--sg-accent`,
`--sg-on-accent`, `--sg-focus`, and `--sg-success`. They are plain properties in a
zero-specificity `:where(:root)` block, not an engine color tier. zudo-doc 6's
`theme.css` supplies package token values without resetting host `--color-*`
properties; the engine's raw `--sg-*` namespace remains separate.

Override engine chrome from the host with an ordinary, unlayered root rule:

```css
:root {
  --sg-border: oklch(0.72 0.02 65);
}
```

The zero-specificity defaults make this hook order-independent. Keep it unlayered when
using cascade layers. If the host used bare `--color-border` to theme engine chrome,
migrate that declaration to `--sg-border` (and use the matching `--sg-*` role for each
other chrome color). Bare `--color-border` remains a valid host component token, but it
no longer controls zudo-sg chrome.

The code panel's editor surface has its own sixteen `--sg-code-*` roles (background,
foreground, gutter, active line, selection, cursor, and the syntax token colors), themed
the same order-independent way. Their `light-dark()` defaults hold WCAG AA (≥ 4.5:1)
contrast and follow the host's `color-scheme`; any override must preserve that contrast.
`SourceEditor`'s `extensions` prop lets a host mounting the editor directly pass its own
CodeMirror extensions, which win over the engine's theme extension — it's read once at
mount, so change it by remounting with a new `key`. `CodePanel` doesn't expose this prop,
since island props must be JSON-serializable. See
[Tokens and preview CSS](../../src/content/docs/architecture/tokens-and-preview-css.mdx)
for the full token list and override example.

Declare host tokens as ordinary `:root` custom properties and map utilities to
those live variables in `wind.tokens`. Pass the host's `wind` configuration in
the preset fragment given to `withZudoSg()`. The helper deep-merges engine tokens
with explicit host entries last, preserves host source controls, and registers
`@takazudo/zudo-sg/wind.json` automatically. Hosts need no manual manifest import.
The defaults declare sm/md/lg/xl at 640/768/1024/1280px, strict compilation,
`dark: false`, `reset: "owned-v1"` and utilities placed before authored CSS.

Keep utility overrides and engine styles unlayered. The `zw-reset` layer precedes
`zd-flow`; the dashboard stylesheet belongs after zudo-doc content CSS.
Configure consumer source roots in `wind.sources`; the engine manifest covers
only engine utility candidates.

`previewStyles` remains an independent CSS entry containing your component
tokens and authored component styles. The preview plugin invokes the host's
installed `zfb css` with composed wind configuration and component roots, then
scopes token roots to `:root[data-sg-preview-doc]`. CSS imports and component
source changes refresh without a restart. Host config or imported token-config
changes require zfb config reload/restart so the snapshot contains fresh data.
This token precedence rule does not isolate every host stylesheet selector.

## External runtime contracts

The public leaf modules `@takazudo/zudo-sg/preview/external-runtime` and
`@takazudo/zudo-sg/registry/external-catalog` contain renderer-free types and
validators. They can be imported in Node/SSR without a browser. React,
ReactDOM, fixture loaders and component closures belong only in the host's
separately built same-origin preview document. The engine shell and catalog
stay zudo-react; the opaque Preact/zdtp adapter remains independent.

These contracts are additive. `preview/messages` remains import-free and
continues accepting legacy messages with no `v` and current `v: 1` messages.
The strict extension uses **both** `v: 1` and `runtimeVersion: 1`; it does not
reinterpret legacy messages. `ExternalRuntimeMode` is `"legacy" |
"external-v1"`. Select strict mode at the parent boundary before the first
message: a strict frame must never fall back to an identity-less legacy ready,
including during startup. `hasExternalRuntimeMarker()` also lets a legacy
receiver identify and reject malformed extension traffic instead of treating
it as legacy. Configure `externalPreview: { url: "/frame/", runtime:
"external-v1" }` to select strict mode in the injected detail route. Direct
`VariantFrame` and `DetailWorkbench` users pass `runtime="external-v1"`.
Omitting it preserves legacy module/vanilla behavior.

Import `createExternalPreviewRuntime` from `@takazudo/zudo-sg/preview/runtime`
inside your external document's entrypoint. Pass `mount` (the renderer-owned
`ExternalFixtureMount`), optional `initialProps`, and `fullReset: true` when
that fixture supports disposal/remount. Optional `target`, `identity`,
`onTheme` and `measureHeight` customize the document, query identity, host
theme side effects and height measurement. The function installs the strict
receiver and token receiver, mounts the fixture, and returns a controller;
importing the module alone installs nothing.

`controller.getSnapshot()` returns copied `{identity, ready, error}` state.
`controller.whenStable()` waits for the committed mount, queued prop updates
and optional fixture stability barrier, then returns the actual runtime
identity. It rejects errors, disposal/reset or props changes during the wait;
capture adapters can retry a changed fixture explicitly. Standalone top-level
capture documents receive a local session identity and emit no parent
messages. A host may expose its controller to its own capture adapter; the
engine installs no global capture object. `reportError`, `reportHeight` and
idempotent asynchronous `dispose` complete the controller API.
Explicit `dispose()` rejects if fixture cleanup fails. Cleanup failures also
reach the optional `onCleanupError` callback (default: `console.error`),
including late cancelled mounts and page unload; they never replace a newer
fixture's error state. Page unload consumes the already reported rejection.
Returning to a disposed document from the browser back/forward cache reloads
that document once to create fresh resources and identity. Explicit disposal
removes this restoration listener as well.

### Identity, readiness and ordering

The parent sends `sg:requestReady` with `slug`, `variant`, and a fresh
`sessionId` challenge, plus the two version fields. Create a new unpredictable
session on iframe load and variant navigation, invalidate previous readiness,
height, document binding and errors, and retain the latest host state. A
same-URL reload requires this transition too: `contentWindow` can retain the
same WindowProxy after its document changes.

The document creates its own unpredictable `documentId`. Its committed
`sg:ready` echoes the challenge and adds `generation: 0`, `sequence`, and
`capabilities: { fullReset: boolean }`. A ready means the fixture mounted and
committed successfully, not merely that message listeners exist. A repeated
request re-announces the same committed document without remounting it. A
mount/import failure sends `sg:runtimeError` instead of successful ready.

All document-bound messages carry the exact
`{slug, variant, sessionId, documentId, generation}` identity and a
nonnegative safe-integer `sequence`. Sequence counters are independent per
sender and per session/generation. Validate the complete message, exact
same-origin and source window, current identity, and then monotonically
increasing sequence **before** mutating state or advancing the receive
watermark. `isExternalRuntimeMessageEvent()`,
`matchesExternalRuntimeIdentity()` and `isNewExternalRuntimeSequence()` are
separate pure checks; none maintains hidden state. Initialize a receive
watermark to `-1`. Reject opaque `"null"` origins and unknown/null sources.

A parent may initially bind a document from a valid ready or error answering
its current challenge and expected generation. Once bound, another document
cannot replace it without a new host session. Only an acknowledged full
reset can advance generation. A stale ready/error/height or malformed
high-sequence message must not affect the active document or its watermark.
Duplicate readiness may replay current snapshots, but cannot reset a fixture.

### Updates, resets, errors and resource ownership

`sg:updateProps` contains a complete `SerializableProps` snapshot that replaces
previous control overrides. `isSerializableProps()` accepts finite JSON values,
rejecting callbacks/elements, undefined, cycles, accessors, symbols, prototype
keys, sparse arrays, and nesting beyond 32 object/array levels. Merge fixture
base props, declared control defaults and this current snapshot in that order.
Ordinary prop edits and the controls' **Reset** update the existing renderer
root and preserve hooks, focus and editor state. Existing module stories
continue their deliberate remount-on-args behavior.

Only runtimes advertising `fullReset: true` receive `sg:resetFixture`. It
targets the current identity and supplies `nextGeneration: generation + 1`.
The runtime disposes the current fixture, advances generation, clears its
per-generation sequence counters and mounts a fresh fixture with the retained
props. Ready/error then identifies the new generation. Reset replay is rejected
by identity/sequence checks. The parent retains controls, resolved theme,
token overrides and live CSS; it replays current state after accepted ready.
Changing variant seeds that variant's controls; reloading the same variant
retains its edited values.

`ExternalFixtureMount(context)` resolves only after a committed mount and
returns an `ExternalFixtureInstance` with `update(props)` and `dispose()`.
Its optional `whenStable()` is a fixture-specific capture barrier after
commit, for fonts, editor initialization or other async resources. The mount
context supplies current identity/props, an abort signal and `reportError()`.
Abort on reset/disposal; check identity after every awaited operation and
dispose any late instance rather than installing it. Serialize asynchronous
updates and resets so an older update cannot overwrite newer props.

The renderer owns its roots, hooks, portals, editors, workers and fixture
subscriptions. The runtime owns its message listeners, observers and timers;
final disposal removes them deterministically. Full fixture reset must not
erase host-owned theme, token overrides or the live-CSS style element.

Errors use `sg:runtimeError` and `{code, message, recoverable}`. Codes are
`unknown-fixture`, `import`, `render`, and `asset`; display messages as text,
never HTML or an empty successful tile. React error boundaries must report
render failures. An initial failure can bind the current document without
claiming readiness; show a reload/retry action. A successful recovery clears
only errors for its accepted identity, never another document's error.

Tokens retain their separate `zudo-sg-token-tweak-bridge` apply/clear/ready
envelopes, with exact parent/source and validated custom-property payloads.
Live CSS retains direct same-origin `contentDocument` injection into
`style[data-sg-injected-css]`. They are not new runtime message types. Keep
their snapshots at the parent, retain edits before readiness, replay on
reload/reset and tear down listeners/styles when their owning scope ends.

### Source and canonical capture metadata

Descriptors may opt into `variant.source = { key, code }`. Obtain `key` from
`externalCatalogKey(slug, exportName)`; it encodes a JSON tuple, avoiding
delimiter collisions. `code` is verbatim text, including JSX or characters
that resemble HTML; never evaluate or inject it as markup. Existing
descriptors without source remain valid. Sourced variants mount the existing
accessible CodePanel, including source tabs/copy and isolated Live CSS. Variants
without source have no Source tab; a completely source-less descriptor has no
panel or panel toggle. `sourcePath` remains informational.

`validateExternalCatalogManifest(input)` validates and normalizes an array of
`ExternalCatalogEntry` rows, each containing `slug`, `variant`,
`loader: {key, module, exportName}`, `source: {key, code}`, and `capture`.
Loader modules are project-root-relative paths; generated loader functions
stay in the external bundle. All three keys must equal the canonical tuple
key, and row identities and captured asset ownership must be unique.

A capture is either `{kind: "image", key, fixture: {module, exportName}, src,
width, height}` matching the loader, or `{kind: "placeholder" | "failed", key,
note}` with an explicit nonempty explanation. Image paths are root-absolute
emitted URLs before adding the site base, with positive integer pixel
dimensions. Existing descriptor image/placeholder/no-thumbnail behavior is
unchanged unless the host opts into this canonical manifest.

This validator checks data, not files or screenshots. An image declaration
promises a real capture of the named external runtime: capture after committed
readiness and its stability barrier, then verify the emitted file, actual
dimensions and fixture/source/loader key agreement before claiming success.
Missing or invalid promised images fail the build/capture check; explicit
failed dispositions throw with their recorded note. Compare exact generated key sets,
source contents and loader references, including extra entries, before build.
The packed React proof is maintained separately. Never substitute engine React
SSR, decorative fake screenshots, or a
host route shadow for this boundary.

### Node prebuild and capture API

Import these Node-only helpers from
`@takazudo/zudo-sg/registry/external-catalog-node` in a host build script.
Do not import them from `zfb.config` (its graph must remain node-free) or from
the browser bundle. The engine does not install a browser or import React.

- `validateExternalCatalogOutputs({manifest, descriptors, loaders, sources})`
  compares complete generated arrays: missing/extra/duplicate keys, actual
  source text and loader module/export references. Generate browser loaders and
  their metadata from the same canonical manifest. The first authored variant
  owns the story's catalog tile; use
  `thumbnailFromExternalCapture(first.capture)` for its thumbnail. Every
  variant's image promise is checked, including those not used for that tile.
- `captureExternalCatalogImages({manifest, projectRoot, assetRoot, origin,
  base, previewUrl, page})` visits the actual external document with canonical
  slug/variant query parameters. `origin` is an HTTP(S) origin without a
  trailing slash, `base` defaults to `/`, and `previewUrl` is the root-absolute
  document path before adding the base.
- `validateExternalCatalogAssets({manifest, projectRoot, assetRoot, captures})`
  checks capture receipts against files. Missing images, stale loader/source
  hashes, wrong image hash/dimensions/fixture identity, and `failed` dispositions
  throw. Intentional placeholders remain labelled. A project or asset root may
  sit below a symlinked ancestor, including macOS `/var` and `/tmp`. The
  configured root itself must be a real directory or absent: a live or dangling
  symlink there is rejected, and so is every symlink beneath that root, even
  one that points back inside it. Missing output directories are created only
  after a successful capture; preflight, validation, and a failed capture do
  not create them. Captures must be complete,
  noninterlaced 8-bit PNGs of at most 16,777,216 pixels, matching the declared
  viewport dimensions. Only IHDR/IDAT/IEND critical chunks are supported;
  palette chunks are outside this browser screenshot format. Legacy descriptor
  SVG/remote image semantics are unchanged.

`loaders` and `sources` are arrays of `ExternalCatalogLoader` and
`DescriptorSource`. Pass actual generated outputs rather than reconstructing
expected copies inside the check. Receipts record actual runtime identity and
SHA-256 hashes of the loader entry file, displayed source and PNG. The loader
hash covers the entry file, not its transitive imports: rerun captures after
fixture dependency or asset changes. Receipts establish capture consistency,
not independent attestation of arbitrary host-supplied metadata.

The caller-owned `page` adapter implements `goto(url)`,
`setViewportSize({width,height})`, `screenshot({type: "png", scale: "css"})`,
`whenStable()` and `getSnapshot()`. The latter two invoke the actual
`createExternalPreviewRuntime()` controller in the loaded document. Wait for
the host-exposed controller property to exist before calling `whenStable()`;
apply the browser runner's normal timeout. The helper checks committed
readiness, errors and identity before and after the screenshot. The host must
surface browser console errors and close its browser/server in `finally`.

Run this sequence from a Node script in the host's build command:

1. Generate descriptors/source/loader metadata from the canonical manifest and
   call `validateExternalCatalogOutputs`.
2. Build the independent external preview, serve it under the intended base,
   and capture into `public/`. Missing promised images cannot represent a
   successful catalog build.
3. Save the returned serializable receipts, validate assets in `public/`, then
   run the final `zfb build` to copy those assets into `dist/`.
4. Validate the same receipts against the emitted asset directory and verify
   built browser loads. Use `assetRoot: "dist"` at the root base; zfb 4 copies
   public assets under the base, so `/styleguide/` uses
   `assetRoot: "dist/styleguide"`. Capture `src` stays `/captures/example.png`;
   the helper resolves it beneath `assetRoot` without adding the URL base.

Adding source text alone neither runs captures nor makes thumbnails mandatory
for existing catalogs. Source-less legacy descriptors do not use this opt-in
manifest check. The focused helper tests cover framework-independent capture
orchestration; the separately installed React consumer supplies real screenshots.

## Release scheme

Stable only. `v*.*.*` tags publish to the npm `latest` dist-tag — there is no
`next` prerelease channel for this package. See the
[release runbook](https://github.com/Takazudo/zudo-sg/blob/main/packages/styleguide/RELEASE.md).

## License

MIT
