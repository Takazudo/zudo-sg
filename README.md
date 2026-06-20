# zudo-sg

A style-guide framework built on [zudo-doc](https://github.com/Takazudo/zudo-doc) (zfb + Tailwind v4 + Preact).

## What this is

A pnpm-workspace monorepo producing three artifacts from one shared component library:

- **Root** — the styleguide host → `https://zudo-sg.takazudomodular.com/`
- **`packages/ui`** — shared Preact component library (single source of truth)
- **`apps/demo`** — demo marketing site → `https://zudo-sg-demo-site.takazudomodular.com/`

## Commands

```sh
# Install all workspace packages
pnpm install

# Build the styleguide host (root)
pnpm build

# Dev server for the styleguide host
pnpm dev
```
