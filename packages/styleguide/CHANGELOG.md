# Changelog

All notable changes to `@takazudo/zudo-sg` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

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
