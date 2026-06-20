# zudo-sg

A style-guide framework built on [zudo-doc](https://github.com/Takazudo/zudo-doc) (zfb + Tailwind v4 + Preact).

> Bootstrap commit. The real scaffold + monorepo land via the implementation plan tracked in **epic [#2](https://github.com/Takazudo/zudo-sg/issues/2)**.

## What this becomes

A pnpm-workspace monorepo producing three artifacts from one shared component library:

- **Root** — the styleguide host → `https://zudo-sg.takazudomodular.com/`
- **`packages/ui`** — shared Preact component library (single source of truth)
- **`apps/demo`** — demo marketing site → `https://zudo-sg-demo-site.takazudomodular.com/`
