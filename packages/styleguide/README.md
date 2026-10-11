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
  (`@takazudo/zudo-sg/plugins/preview-css`) that compiles the host's own token
  CSS with `@tailwindcss/node` and rescopes it under
  `:root[data-sg-preview-doc]` so it coexists with the host's global
  stylesheet.
- Generated wind manifest and chrome styles (`@takazudo/zudo-sg/wind.json`,
  `@takazudo/zudo-sg/styles.css`) so the catalog UI ships its own Tailwind
  utilities without depending on the host's content scan.
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

Preact + zfb hosts only. React 19 hosts are an explicit non-goal for this
release (see the ADR's "Framework scope" decision for the seam that would
enable them later).

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

It copies a private starter with three example Preact components, stories,
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
pnpm add @takazudo/zudo-sg@latest @takazudo/zfb@^4.3.1 @takazudo/zfb-md-wasm@^4.3.1 @takazudo/zfb-runtime@^4.3.1 @takazudo/zudo-doc@^6.0.0 @takazudo/zdtp@^0.8.6 diff@^8.0.4 katex@^0.16.38 zod@^4.3.6
```

The engine peers are `@takazudo/zfb ^4.3.1`, `@takazudo/zudo-doc ^6.0.0`,
and `@takazudo/zdtp ^0.8.6`. `@takazudo/zdtp` is required:
the injected `/tokens` route loads its dashboard through the engine-owned
Preact adapter. The engine installs Preact as its own regular dependency. The
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
peer floor (≥ 2.18.0) nothing else is needed: `zfb dev` seeds its island
scanner from the injected routes. `@takazudo/zudo-sg/islands` remains
exported as a side-effect module that statically imports every engine
island — importing it once from a host `pages/` file is optional and
harmless (it was required on zfb < 2.18.0).

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
zero-specificity `:where(:root)` block, not an engine color tier. zudo-doc's
`theme.css` resets `--color-*`, so these raw properties survive regardless of whether
the engine stylesheet is imported before or after that reset.

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

## Release scheme

Stable only. `v*.*.*` tags publish to the npm `latest` dist-tag — there is no
`next` prerelease channel for this package. See the
[release runbook](https://github.com/Takazudo/zudo-sg/blob/main/packages/styleguide/RELEASE.md).

## License

MIT
