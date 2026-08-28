# zudo-sg

A style-guide framework built on [zudo-doc](https://github.com/Takazudo/zudo-doc) (zfb + Tailwind v4 + Preact).

## What this is

A pnpm-workspace monorepo producing four artifacts from one shared component library:

- **Root** — the styleguide host and component catalog → `https://zudo-sg.takazudomodular.com/`
- **`doc/`** — the full documentation workspace → `https://zudo-sg-doc.takazudomodular.com/`
- **`packages/ui`** — shared Preact component library (single source of truth)
- **`apps/demo`** — demo marketing site → `https://zudo-sg-demo-site.takazudomodular.com/`

The root site intentionally keeps `/docs` slim: it contains a short Guide for
styleguide-specific workflows and links to the full documentation site. The
`doc/` workspace owns generated Claude resources and the doc-lookup skill
wiring.

## Repository ownership

This repository owns the styleguide, its component stories, and the
`@zudo-sg/ui` component provider. Composer metadata is authored beside each
opted-in component in a typed `*.composer.tsx` sidecar and assembled into the
public `@zudo-sg/ui/composer-pack` export. Stories consume sidecar display
metadata for the catalog, but story modules are not inputs to the provider.

The standalone [zudo-composer](https://github.com/Takazudo/zudo-composer)
repository owns the Composer and Sitemapper products after the split. The
legacy `/composer`, `/composer/preview`, and `/sitemapper` routes remain
operational here only as a temporary Phase 2 verification seam; Phase 4 removes
them after the standalone handoff is proven.

There are currently zero users and zero production Composer/Sitemapper data.
No backward-compatibility, migration, redirect, alias, or old-storage obligation
exists. Both repositories may make destructive clean-current-schema changes.

The immutable provider coordinates live in
[`ui-provider-handoff.json`](./ui-provider-handoff.json). Contributors finish
all `packages/ui` changes before advancing the package-only `package/ui-v1`
ref, then run `pnpm verify:ui-provider-install -- --exact`. A source `main` SHA
or green CI URL is recorded only after the merge and checks actually exist.

## Commands

```sh
# Install all workspace packages
pnpm install

# Build the styleguide host (root)
pnpm build

# Build the full docs workspace
pnpm build:doc

# Dev server for the styleguide host
pnpm dev

# Verify the exact package-only provider handoff
pnpm verify:ui-provider-install -- --exact
```
