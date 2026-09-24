# Changelog

All notable changes to `@takazudo/zudo-sg` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

## [0.3.5] - 2026-09-25

This release makes the public preview trigger reliable during SPA navigation
and keeps story detail routes distinct from the iframe preview endpoint.

### Bug Fixes

- Capture clicks on a visible preview-token header trigger before the load
  island is ready, then replay the pending toggle exactly once.
- Allocate distinct story slugs when a default or custom preview endpoint
  occupies a component detail URL. Route options now stay consistent across
  the catalog, detail pages, and host registry.

### Verification

- Exercise the packed engine in an independent host, including a deterministic
  early-click browser check and rendered story identities for default and
  custom preview routes.

## [0.3.4] - 2026-09-24

This release aligns the engine's peer requirements with the tested zfb,
zudo-doc, and zdtp versions. It also updates the GitHub Actions dependencies
used by the publish workflow.

## [0.3.3] - 2026-09-23

### Bug Fixes

- Preserve a host's semantic colors in inline component thumbnails. The engine
  no longer replaces them with demo-specific palette variables, so hosts with
  their own palette names need no local stylesheet override.

## [0.3.2] - 2026-09-23

### Features

- Configure an ordered host-owned vocabulary with `tokens.spec` for palette,
  semantic colors, spacing, fonts, and sizes. CSS supplies values, while the
  spec controls groups, labels, controls, options, units, and previews.
- Carry custom token metadata into the dashboard and preview panel, including
  sparse palettes and unrelated CSS variable prefixes. Hosts that omit the
  spec retain the existing default vocabulary and legacy manifest support.
- Validate custom specs before writing generated files and document the
  supported metadata and CSS parser constraints.

### Bug Fixes

- Generate components without a demo-local class-name helper dependency and
  import story types from the public `@takazudo/zudo-sg/stories` entry point.
  Flat and nested scaffolds now typecheck and build in a fresh starter.
- Allocate deterministic, unique registry import bindings for sibling stories,
  multiple roots, sanitized names, and names reserved by generated code.
- Keep the starter's token adapter compatible with legacy five-array manifests
  while accepting optional host-group metadata.

## [0.3.1] - 2026-09-21

The preview token panel is now reachable from the doc header, not just from the
workbench button and the `/tokens` dashboard. The engine injects that trigger
itself, so adopting hosts get it without wiring anything.

### Features

- `withZudoSg()` appends a preview-token-panel trigger to the doc header's right
  side, revealed only on engine routes. Gated by the new `headerTokenTrigger`
  option, which defaults to `true`.
- Export `HEADER_TOKEN_TRIGGER_ITEM` so a host that renders its own zudo-doc
  header can list the trigger alongside its own items.
- Emit a `data-sg-engine-route` marker from `bodyEnd` on every chrome-rendered
  engine route, and on the preview iframe document's own `html` tag, so client
  code can detect "this page can use the preview token panel" after each
  navigation.
- `ZdtpApplyProxyOptions` now accepts `tabsModule` on its own: `routingFile` and
  `writeRoot` became optional together, so a host can wire the panel's tabs
  without opting into the dev-only Apply endpoint. Supplying exactly one of the
  pair still fails at both the type level and at runtime.

## [0.3.0] - 2026-09-21

The catalog chrome no longer borrows a host's bare `--color-*` tokens. It now
reads its own `--sg-*` namespace, so the code panel, workbench toolbar, and
segmented controls render correctly no matter where a host imports its
component theme relative to `@takazudo/zudo-doc/theme.css`.

### Breaking Changes

- Chrome colors are read from `--sg-*`, not from bare `--color-*` theme keys.
  A host that recolored the chrome by defining `--color-border`,
  `--color-surface-2`, `--color-focus`, `--color-border-strong`, or
  `--color-on-accent` must now override the matching `--sg-*` custom property
  instead — for example `:root { --sg-border: oklch(0.86 0.006 65); }`. Hosts
  that never themed the chrome need no change.

### Features

- The engine declares eleven raw-tier chrome roles — `--sg-bg`, `--sg-fg`,
  `--sg-surface`, `--sg-surface-2`, `--sg-border`, `--sg-border-strong`,
  `--sg-muted`, `--sg-accent`, `--sg-on-accent`, `--sg-focus`, and
  `--sg-success` — each derived from zudo-doc's scheme-aware `--zd-*` tier with
  a literal fallback. They are declared at zero specificity, so a host's plain
  `:root` override wins in any import order.
- A new `check:chrome-tokens` lint fails the build when engine chrome code
  reintroduces a bare color utility, and the package safelist check now asserts
  that real candidates were extracted rather than passing on an empty set.

### Bug Fixes

- The chrome no longer half-renders when a host imports its own component color
  tokens before `@takazudo/zudo-doc/theme.css`. That file's `--color-*: initial`
  wipes every `--color-*` theme key declared before it, which previously erased
  the borders and surfaces the chrome depended on with no build-time or runtime
  signal.
- The code panel divider, workbench toolbar and toggle fills, and the tile-size
  segmented control keep a visible border and a filled surface in both light and
  dark schemes.

## [0.2.2] - 2026-09-20

Minimal hosts now expose the engine's routes in their header without requiring
additional navigation configuration.

### Bug Fixes

- `withZudoSg` fills an empty host header with Components and Design Tokens
  links and a search control. Existing non-empty navigation remains unchanged,
  and `chromeDefaults: false` preserves an intentionally empty header.
- Default engine links honor custom route paths and deployment bases while
  remaining global on translated and versioned documentation pages.

## [0.2.1] - 2026-09-20

This release removes host-specific assumptions from generated registries and
token manifests, while making first-time registry generation self-starting.

### Bug Fixes

- Generated registries now import the engine-owned `StoryModule` type instead
  of depending on the repository's demo UI package.
- Token manifests preserve each CSS input's configured import specifier, so
  generated output remains valid when a host uses relative or package paths.
- `gen-registry` now creates a missing or whitespace-only output file and its
  parent directories. Existing non-empty files without generated markers are
  still protected from overwrite.

### Other Changes

- Raised the engine peer floors to `@takazudo/zfb ^2.20.0` and
  `@takazudo/zudo-doc ^5.26.2`.
- Expanded foreign-host and initializer verification around generated output.

## [0.2.0] - 2026-09-20

A requirements release. The engine's code is unchanged, but its published peer
floors move up, so a host on an older toolchain must upgrade its peers before
installing this version. That is why it is a minor bump rather than a patch.

### Breaking Changes

- **Raised peer floors.** `@takazudo/zfb` is now `^2.19.0` (was `^2.18.0`),
  `@takazudo/zudo-doc` is now `^5.26.0` (was `^5.25.0`), and `preact` is now
  `^10.29.8` (was `^10.29.1`). The zfb floor follows `@takazudo/zudo-doc`
  5.26.0's own requirement. Upgrade these three in the host before moving to
  0.2.0; hosts that stay on the older peers should remain on 0.1.x.

### Other Changes

- Bumped the `postcss` dependency to `^8.5.28`.
- The README now documents upstream provenance, the current peer requirements,
  and scaffolding a new host with the `create-zudo-sg` initializer.

## [0.1.2] - 2026-09-19

A toolchain-only release. The engine is built and verified against
`@takazudo/zfb` 2.19.0, but its published requirements are unchanged, so
upgrading from 0.1.1 needs no action from adopters.

### Other Changes

- Moved the development toolchain to the `@takazudo/zfb` 2.19.0 family
  (`zfb`, `zfb-runtime`, `zfb-md-wasm`). The release adds an opt-in build
  debugging flag and an internal dependency bump; it changes no API the engine
  consumes.
- **The `@takazudo/zfb` peer floor stays `^2.18.0`.** It was raised to
  `^2.18.0` only because `@takazudo/zudo-doc` 5.25.0's own floor forced it, and
  that floor has not moved. Raising it again for a release the engine does not
  depend on would bind adopters to a newer zfb for no benefit, so hosts on zfb
  2.18.x remain supported.
- Verified by the foreign-install check, which installs the package outside the
  workspace under strict peer resolution with no peer auto-install, and by the
  seedless dev-server regression guard for injected-route island and CSS
  discovery, both run against zfb 2.19.0.

## [0.1.1] - 2026-09-17

Updates the styleguide engine to use zudo-doc's native sidebar integration
and zfb's package-route island discovery.

### Changed

- Raised the `@takazudo/zfb` peer floor to `^2.18.0` and the
  `@takazudo/zudo-doc` peer floor to `^5.25.0` (matching exact
  `devDependencies` pins). This is forced, not elective: zudo-doc 5.25.0
  raised its own `@takazudo/zfb` peer floor to `^2.18.0`, so the engine's
  floor must follow to keep resolving against it.
- Pass the component navigation tree through zudo-doc's native `sidebarNodes`
  header prop, removing the need for a host-bound Header workaround.
- Document that zfb 2.18.0 discovers engine islands from injected routes during
  development. The `@takazudo/zudo-sg/islands` entry point remains available
  for API compatibility, but hosts no longer need it as a dev-hydration seed.

## [0.1.0] - 2026-09-15

Initial release of `@takazudo/zudo-sg`, the installable styleguide engine
package.

### Features

- Package-owned catalog routes — `/components`, `/components/[slug]`,
  `/components/preview`, `/tokens` — injected into a host's zfb build via
  `@takazudo/zudo-sg/plugins/routes`, mirroring `@takazudo/zudo-doc`'s
  route-injection seam.
- `zudo-sg` CLI: `gen-registry [--check]`, `new-component <name> --category <c>
  [--nested] [--skip-barrel]`, `gen-token-manifest [--check]`, all driven by a
  host `zudo-sg.config.mjs`.
- Story-authoring contract (`@takazudo/zudo-sg/stories`): `StoryMeta`,
  `Story`, `StoryControl`, `StoryModule`, `defineStory`. Story
  categories are open, host-ordered data, not a closed type.
- Standalone preview stylesheet compiler (`@takazudo/zudo-sg/plugins/preview-css`)
  that compiles the host's token CSS with `@tailwindcss/node` and rescopes it
  under `:root[data-sg-preview-doc]` so it coexists with the host's own global
  stylesheet.
- Generated safelist and chrome styles (`@takazudo/zudo-sg/safelist.css`,
  `@takazudo/zudo-sg/styles.css`) so package-owned catalog UI ships its own
  Tailwind utilities without depending on the host's content scan.
- Token dashboards and the preview design-token panel, driven by a
  `gen-token-manifest`-produced manifest.
- Framework scope: Preact/zfb hosts only for this release.
- Release toolchain: `@takazudo/zfb` 2.17.0 with `@takazudo/zudo-doc` 5.24.0.
  The injected `/tokens` route makes `@takazudo/zdtp ^0.8.0` a required peer.
