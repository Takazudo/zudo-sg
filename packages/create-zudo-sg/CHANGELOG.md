# Changelog

All notable changes to `create-zudo-sg` are documented in this file.

The format is based on Keep a Changelog.

## [0.1.2] - 2026-09-20

Gives fresh starter projects a styled homepage and usable default navigation.

### Fixed

- Style the host-owned homepage with token-based typography, spacing, and
  clearly visible links to Components and Design Tokens after Tailwind preflight.
- Verify the packed starter's homepage markup and generated utility CSS.

### Changed

- Update the starter engine range to `@takazudo/zudo-sg ^0.2.2`, which supplies
  default header navigation and search controls for minimally configured hosts.

## [0.1.1] - 2026-09-20

Hardens fresh starter projects and aligns them with `@takazudo/zudo-sg 0.2.1`.

### Fixed

- Include the complete host stylesheet needed by the catalog, detail
  workbench, token dashboard, and responsive sidebar.
- Ignore generated zfb cache and temporary build artifacts while continuing to
  track the generated lockfile.
- Exempt the starter's exact shipped zfb, zudo-doc, zdtp, and zudo-sg versions
  from pnpm's minimum-release-age policy, including zfb platform binaries.
- Let the first `gen-registry` run create its output instead of requiring a
  marker-only seed file.

### Changed

- Update the starter engine range to `@takazudo/zudo-sg ^0.2.1`.
- Verify generated lockfiles with a clean frozen install before release.

## [0.1.0] - 2026-09-20

Initial release of the pnpm-only `create-zudo-sg` initializer.

### Added

- Scaffold a private Preact + zfb host from the bundled starter template.
- Support project-directory prompts, npm package-name validation, `--name`,
  `--install` / `--no-install`, `--yes`, `--help`, and `--version`.
- Include the working `@takazudo/zudo-sg` host configuration, example stories,
  token CSS, generated-registry seed, and preview stylesheet entry.
