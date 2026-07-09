# zudo-sg

A style-guide framework built on [zudo-doc](https://github.com/Takazudo/zudo-doc) (zfb + Tailwind v4 + Preact).

## What this is

A pnpm-workspace monorepo producing four artifacts from one shared component library:

- **Root** — the styleguide host and component catalog → `https://zudo-sg.takazudomodular.com/`
- **`doc/`** — the full documentation workspace → `https://zudo-sg-doc.takazudomodular.com/`
- **`packages/ui`** — shared Preact component library (single source of truth)
- **`apps/demo`** — demo marketing site → `https://zudo-sg-demo-site.takazudomodular.com/`

The root site intentionally keeps `/docs` slim: it contains a short Guide for
styleguide-specific workflows and links out to `/doc` for the full product
documentation. The `doc/` workspace owns generated Claude resources and the
doc-lookup skill wiring.

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
