# Changelog

All notable changes to `create-zudo-sg` are documented in this file.

The format is based on Keep a Changelog.

## [0.1.4] - 2026-09-21

Gives a fresh starter a working preview token panel, not just the button that
opens one.

### Added

- Scaffold the wiring the preview token panel needs: a `_body-end-islands.tsx`
  that mounts `PreviewTokenPanelBootstrap` on the injected `/components/*` and
  `/tokens` routes, a `_chrome-bindings.tsx`, a generated
  `src/styleguide/token-manifest.ts`, and a `src/config/preview-token-panel-tabs.ts`
  the panel reads its tabs from.
- Turn on `bundleZdtp` and a tabs-only `zdtpApplyProxy` in the starter's
  `zfb.config.ts`, so the panel gets the real zdtp loader instead of the
  throwing stub without opting into the dev-only Apply endpoint.

### Changed

- Update the starter engine range to `@takazudo/zudo-sg ^0.3.1`, whose header
  token trigger opens the panel the scaffold now wires.
- Document the new scaffold contents and the `routingFile` + `writeRoot` opt-in
  for the panel's Apply step in the README.

## [0.1.3] - 2026-09-21

Stops fresh starters from requesting favicons they never shipped, and moves
them onto the engine's new chrome token namespace.

### Fixed

- Set the starter's favicon to the self-contained inline icon instead of
  advertising four `/favicon*` files the template does not create, which made a
  clean build log four missing-asset errors on first load.
- Verify after every packed build that each local head asset a generated page
  links to actually exists, so a reintroduced missing icon or stylesheet fails
  the release gate rather than the adopter's browser console.

### Changed

- Update the starter engine range to `@takazudo/zudo-sg ^0.3.0`, which reads its
  chrome colors from the `--sg-*` namespace. The starter's own stylesheet now
  sets those roles explicitly, so the catalog chrome renders correctly whatever
  order a project imports its component theme in.

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
