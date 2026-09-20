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
- Generated safelist and chrome styles (`@takazudo/zudo-sg/safelist.css`,
  `@takazudo/zudo-sg/styles.css`) so the catalog UI ships its own Tailwind
  utilities without depending on the host's content scan.
- Token dashboards and a preview design-token panel, driven by a
  `gen-token-manifest`-produced manifest.

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

`gen-registry` bootstraps a missing or whitespace-only `registryOut` and its
parent directories, so a new host does not need to create a marker-only seed
file by hand. A non-empty registry without generated markers is rejected to
protect hand-authored content. `gen-registry --check` reports missing or empty
output as drift and never writes it.

## Installation

```sh
pnpm add @takazudo/zudo-sg@latest @takazudo/zfb@^2.19.0 @takazudo/zfb-md-wasm@^2.19.0 @takazudo/zfb-runtime@^2.19.0 @takazudo/zudo-doc@^5.26.0 @takazudo/zdtp@^0.8.0 diff@^8.0.4 katex@^0.16.38 preact@^10.29.8 preact-render-to-string@^6.6.6 tailwindcss@^4.2.0 zod@^4.3.6
```

The engine peers are `@takazudo/zfb ^2.19.0`, `@takazudo/zudo-doc ^5.26.0`,
`@takazudo/zdtp ^0.8.0`, and `preact ^10.29.8`. `@takazudo/zdtp` is required:
the injected `/tokens` route imports its dashboard at build time. The
`@takazudo/zfb-md-wasm`, `@takazudo/zfb-runtime`, `diff`, `katex`, and `zod`
entries are prerequisites inherited from zfb/zudo-doc; zudo-doc's published
route dist imports `diff` and `katex` even when those features are disabled
(see [zudolab/zudo-doc#4206](https://github.com/zudolab/zudo-doc/issues/4206)).
`preact-render-to-string` and `tailwindcss` are host-specific dependencies used
by the fixture's component and preview-style setup, respectively; add them
when your host uses those same pieces. The command above reproduces the full
fixture dependency set.

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
preset's own. The engine requires `packageOwnedRoutes: true` on the host (its
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

Full option shape, virtual modules, and every locked constant:
`docs/adr/styleguide-engine.md` in this repository.

## Release scheme

Stable only. `v*.*.*` tags publish to the npm `latest` dist-tag — there is no
`next` prerelease channel for this package. See the
[release runbook](https://github.com/Takazudo/zudo-sg/blob/main/packages/styleguide/RELEASE.md).

## License

MIT
