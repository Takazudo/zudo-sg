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

## Installation

```sh
pnpm add @takazudo/zudo-sg
```

Peer dependencies: `@takazudo/zfb ^2.16.0`, `@takazudo/zudo-doc ^5.22.0`,
`preact ^10.29.1`. `@takazudo/zdtp` is an **optional** peer — only needed if
the host wires up the dev-only design-token apply proxy
(`@takazudo/zudo-sg/plugins/zdtp-apply-proxy`).

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
      uiPackageName: "@your-scope/ui",
      previewStyles: "./src/styles/preview-entry.css",
    },
  ),
);
```

`withZudoSg` merges the engine's plugins and collections after the zudo-doc
preset's own. The engine requires `packageOwnedRoutes: true` on the host (its
routes import zudo-doc's route-context virtual modules) and — because `zfb
dev` only scans a host's own `pages/` tree for `"use client"` islands — a host
`pages/` file that statically imports `@takazudo/zudo-sg/islands` once (see
the ADR's "Island rule" for why).

Full option shape, virtual modules, and every locked constant:
`docs/adr/styleguide-engine.md` in this repository.

## Release scheme

Stable only. `v*.*.*` tags publish to the npm `latest` dist-tag — there is no
`next` prerelease channel for this package. See the
[release runbook](https://github.com/Takazudo/zudo-sg/blob/main/packages/styleguide/RELEASE.md).

## License

MIT
