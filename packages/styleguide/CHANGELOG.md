# Changelog

All notable changes to `@takazudo/zudo-sg` are documented in this file.

The format is based on Keep a Changelog, and release notes are generated from the changelog MDX pages.

## [Unreleased]

### Changed

- Raised the `@takazudo/zfb` peer floor to `^2.18.0` and the
  `@takazudo/zudo-doc` peer floor to `^5.25.0` (matching exact
  `devDependencies` pins). This is forced, not elective: zudo-doc 5.25.0
  raised its own `@takazudo/zfb` peer floor to `^2.18.0`, so the engine's
  floor must follow to keep resolving against it.

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
