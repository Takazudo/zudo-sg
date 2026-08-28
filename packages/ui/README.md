# `@zudo-sg/ui`

Preact components and the typed component provider for zudo-sg. This package
owns components, component stories, Composer sidecars, the generated component
pack, and the CSS needed to render that pack. The Composer and Sitemapper
applications themselves live in
[Takazudo/zudo-composer](https://github.com/Takazudo/zudo-composer).

## Public provider boundary

```ts
import {
  componentPack,
  componentPackManifest,
  componentRuntimeRegistry,
} from "@zudo-sg/ui/composer-pack";
import "@zudo-sg/ui/styles/composer.css";
```

`componentPackManifest` is JSON-safe provider data. The runtime registry keeps
the trusted Preact components and optional render/inline-editor adapters. Both
are generated from co-located `src/**/*.composer.tsx` sidecars; story modules
are not scanned or imported when the pack is built.

## Component authoring rule

- Put the definition beside the component as `<name>.composer.tsx`.
- Author it with `defineComponent` from
  `@zudo-composer/component-contract`.
- Assign stable persisted component `id`, `schemaVersion`, field `prop`, and
  slot `id`/`prop` values explicitly.
- Use the public source `{ module: "@zudo-sg/ui", exportKind, exportName }`.
  Never publish a private `@zudo-sg/ui/src/*` source path.
- Export `title`, `category`, and `description` as one display object. The
  component story imports/spreads that object; stories never contain provider
  definitions and are never provider inputs.
- From the zudo-sg source repository root, run `pnpm gen:composer-pack` after
  adding or removing a sidecar and commit the generated
  `src/composer-pack.ts` result.

The complete story and sidecar rules live in [`STORIES.md`](./STORIES.md).

## Exact Git installation

The provider is handed off as a package-only Git commit whose repository root
is this directory's tree. The source repository's
`ui-provider-handoff.json` is the only source of the exact UI and component
contract Git specs. Do not use `workspace:`, `file:`, `link:`, sibling paths,
or Git `path:` selectors in an external consumer.

Before advancing the handoff, finish every change under `packages/ui`, advance
the local `package/ui-v1` ref, refresh the handoff JSON, and run these commands
from the zudo-sg source repository root (they are not package-root scripts):

```sh
pnpm check:composer-pack
pnpm check:ui-provider-boundary
pnpm test:ui-provider-package
pnpm verify:ui-provider-install -- --exact
```

The post-merge source SHA and CI URL are recorded only after merge and green
checks. There are currently zero users and zero production data, so the package
has no backward-compatibility, migration, redirect, alias, or old-storage
obligation; clean-current-schema changes may be destructive.
