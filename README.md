# zudo-sg

A style-guide framework built on [zudo-doc](https://github.com/Takazudo/zudo-doc) (zfb + Tailwind v4 + Preact).

## What this is

A pnpm-workspace monorepo producing four artifacts from one shared component library:

- **Root** — the styleguide host and component catalog → `https://zudo-sg.takazudomodular.com/`
- **`doc/`** — the full documentation workspace → `https://zudo-sg-doc.takazudomodular.com/`
- **`packages/demo-ui`** — shared Preact component library (single source of truth)
- **`apps/demo`** — demo marketing site → `https://zudo-sg-demo-site.takazudomodular.com/`

The root site and the `doc/` workspace are two independently built, tested, and
deployed sites with no navigation between them — the root site's `/docs`
contains a short, self-contained Overview of the styleguide host. The `doc/`
workspace owns generated Claude resources, the doc-lookup skill wiring, and the
full zudo-sg documentation.

## Repository ownership

This repository owns the styleguide, its component stories, and the
`@zudo-sg/demo-ui` component library. `demo-ui` is this repo's own showcase
library — a components-only package with co-located stories, catalogued to
prove the styleguide engine on a real project. It is not installed by the
engine or its scaffold CLI, and it is not shipped as a provider to any other
product.

The standalone [zudo-composer](https://github.com/Takazudo/zudo-composer)
repository owns the Composer and Sitemapper products, including their routes,
application code, persistence, CI, and deployment. zudo-composer has no
coupling to this repository.

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
```
