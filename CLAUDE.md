# Zudo Sg

Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **zfb** — documentation build framework
- **MDX** — content format
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands only (with compat mode for React API)
- **syntect** — built-in code highlighting, run by zfb's Rust pipeline at build time (dual-theme, matching the site's light/dark mode). The themes are WCAG-AA-compliant variants of `base16-ocean` — `Base16 Ocean Light A11y` / `Base16 Ocean Dark A11y`, defined in `src/styles/syntect-themes/*.tmTheme` and wired via `codeHighlight` in `zfb.config.ts` (#169; stock base16-ocean fails AA for most tokens)

## Commands

- `pnpm dev` — zfb dev server (port 4321)
- `pnpm build` — static HTML export to `dist/`
- `pnpm check` — TypeScript type checking

## Key Directories

```
pages/                    # File-based routing (host-owned: /, /components/*, /docs/versions)
│                         # zudo-doc's package injects the rest (docs, 404, robots, sitemap)
src/
├── components/           # JSX + Preact components
│   └── content/          # MDX content components (admonitions, code-group, ...)
├── config/               # Settings, color schemes, design token manifests
├── content/
│   └── docs/             # Slim root guide content
├── features/
│   └── styleguide/       # /components catalog: chrome, preview, code-panel, search, token-tweak
├── styleguide/
│   └── data/             # Codegen-backed component registry + nav nodes (#103)
└── styles/
    └── global.css        # Design tokens & Tailwind config
```

There is no `src/pages/` or `src/layouts/` — routing lives in the root `pages/`
directory, and page-level chrome (header, footer, doc-route shells) is owned
by `@takazudo/zudo-doc`'s package-injected routes (`packageOwnedRoutes`,
see `src/config/settings.ts`).

The tree above covers only the root host's own `src/`. `packages/ui`'s
component tree and `apps/demo`'s content/route tree are separate workspace
packages — see "Monorepo Structure" below.

Root `/docs` is intentionally slim and currently contains the root Guide. The
full documentation site lives in `doc/` and is deployed separately at
`https://zudo-sg-doc.takazudomodular.com/`; root nav/footer entries link there
instead of duplicating that content.

## Content Conventions

### Frontmatter

- Required: `title` (string)
- Optional: `description`, `sidebar_position` (number), `category`
- Sidebar order is driven by `sidebar_position`

### Admonitions

Available in all MDX files without imports: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`,
`<Caution>`, `<Details>` (via `:::name` directives, registered in `zfb.config.ts`) — plus
`<Important>` from GitHub-style `[!IMPORTANT]` blockquote alerts. Each accepts an optional
`title` prop; `Details` renders as a collapsible section.

### Headings

Do NOT use h1 (`#`) in doc content — the page title from frontmatter is rendered as h1. Start content headings from h2 (`##`).

## Components

- Default to **server-rendered JSX components** (`.tsx`) — zero JS, server-rendered
- Use **Preact islands** only when client-side interactivity is needed: mark the component
  module `"use client"` and mount it via zfb's `<Island ssrFallback={...}>` wrapper
  (`when: "load"` or `"idle"`) — see `pages/lib/_body-end-islands.tsx` for the pattern.
  There is no `client:load`-style directive; that was an Astro-era convention this project
  no longer uses.

## Monorepo Structure

This is a pnpm workspace monorepo:

- **Root (`.`)** — the zudo-doc styleguide host and component catalog
- **`doc/`** (`@zudo-sg/doc`) — the full docs workspace; owns Claude resource
  generation and doc-lookup skill setup
- **`packages/ui`** (`@zudo-sg/ui`) — shared Preact component library: ~70
  components under `src/<category>/<component>/`, grouped into 9 category
  directories (`cards/ chrome/ content/ forms/ landing/ media/ news/ search/
  shared/`)
- **`apps/demo`** (`@zudo-sg/demo`) — multi-page corporate demo site
  (Tailwind v4, no SSR): a ~70-entry content collection under `content/`
  drives nav/footer/breadcrumbs from frontmatter, plus cross-site search
  (`/search`), an SPA-style client router with View Transitions
  (`components/router/`), and per-business-line theming (`config/lines.ts`,
  `styles/lines.css`)

`@zudo-sg/ui` is consumed from **source** — its `exports` map points at `./src/*`
directly and it has no `build` script, so edits are picked up by consumers immediately;
there is no dist step to run.

To build all packages: `pnpm install && pnpm build` (root only; apps/demo builds with `pnpm --filter @zudo-sg/demo build`).

### Design tokens

`@zudo-sg/ui` colors follow a grouped three-tier strategy: Tier-1
`--palette-{group}-{n}` ramps (`base`, `accent`, `state`, plus a `line-*`
ramp per business line) feed Tier-2 semantic `@theme` roles (`bg`, `surface`,
`surface-2`, `border`, `fg`, `muted`, `accent`, `accent-hover`, `on-accent`,
`focus`, the `rail-*` family, and the state colors), defined in
`packages/ui/styles/colors.css`. Components bind only to the Tier-2 semantic
utilities (`bg-accent`, `text-fg`, `border-border`, …) — the Tier-1 palette
is a plain `:root` block, never `@theme`, so no `bg-palette-*` utility is
ever generated. Full contract: `packages/ui/STORIES.md` §"Three-tier color
system". This is independent of the doc-chrome's own `--zd-*` token world
(`src/styles/global.css`) — see `.claude/skills/zudo-doc-design-system/SKILL.md`
for how the two worlds relate.

## Enabled Features

- **search** — Full-text search via MiniSearch (`pages/lib/_search-widget.tsx`); the
  sidebar also has its own real-time filter input, implemented in the
  `@takazudo/zudo-doc/sidebar-tree-island` package island (not a separate
  toggleable feature)
- **imageEnlarge** — Click-to-enlarge images
- **claudeResources** — Moved to the `doc/` workspace
- **claudeSkills** — The `doc/` workspace ships zudo-doc-design-system, zudo-doc-translate, zudo-doc-version-bump skills
- **designTokenPanel** — Interactive tabbed panel for tweaking spacing, font, size, and color tokens
- **dynamicPageTransition** — SPA client-router page swaps with View Transitions and page-loading overlay
- **sidebarResizer** — Draggable sidebar width
- **sidebarToggle** — Show/hide desktop sidebar
- **versioning** — Multi-version documentation support
- **llmsTxt** — Generates llms.txt for LLM consumption
- **skillSymlinker** — Moved to the `doc/` workspace (`pnpm --filter @zudo-sg/doc setup:doc-skill`)
- **footerNavGroup** — Footer navigation link groups
- **footerCopyright** — Footer copyright notice
