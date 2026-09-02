# Zudo Sg

Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **zfb** — documentation build framework. The `@takazudo/zfb*` family is pinned to the stable
  `2.14.3` release in lockstep with zudo-doc 5.16.1.
- **MDX** — content format
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands only (with compat mode for React API)
- **syntax highlighting** — built-in class-mode code highlighting, run by zfb's Rust pipeline at build time: fences render as semantic `hi-*` token classes under `pre.hi-root`, mapped to this project's `--zd-syntax-*` design tokens via `@takazudo/zudo-doc/features.css`'s `--zfb-hi-*` bridge — no project-owned renderer, theme, or `codeHighlight` config required. This superseded the old project-owned WCAG-AA `base16-ocean` tmTheme pair from #169, so syntax colors inherit the site's existing semantic tokens rather than being baked per-span at build time.

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

## Component provider and product split

- **zudo-sg owns the provider** — components, stories, typed
  `*.composer.tsx` sidecars, generated `packages/ui/src/composer-pack.ts`, and
  the explicit `packages/ui/styles/composer.css` entry live here.
- **Authoring rule** — use `defineComponent` from
  `@zudo-composer/component-contract` in a co-located sidecar. Persisted
  component `id`, `schemaVersion`, field `prop`, and slot `id`/`prop` are
  explicit stable keys. `source.module` is the public `@zudo-sg/ui` package
  export, never a private `/src/*` path. Export display metadata from the
  sidecar; the story imports/spreads it, but no provider code imports stories.
- **Generated boundary** — `pnpm gen:composer-pack` discovers sidecars and
  generates the manifest/runtime pack. `pnpm check:composer-pack` rejects
  drift. Consumers import `@zudo-sg/ui/composer-pack` and
  `@zudo-sg/ui/styles/composer.css`.
- **Immutable handoff** — `ui-provider-handoff.json` records the package tree,
  package-only commit, exact Git spec, and exact component-contract commit.
  Finish package docs/code first, advance local `package/ui-v1`, then run
  `pnpm verify:ui-provider-install -- --exact`. Never pre-claim the post-merge
  source SHA or CI URL.
- **zudo-composer owns the products** — the standalone repository owns both
  Composer and Sitemapper, including their clean storage/schema identities,
  routes, application UI, and deployment.
- **zudo-sg owns the styleguide and provider** — the host routes, catalog,
  stories, provider sidecars/pack/CSS, and provider verification remain here;
  no Composer or Sitemapper application code lives in this repository.
- **No compatibility contract** — there are zero users and zero production
  Composer/Sitemapper data. Destructive current-only cleanup is required; do not add
  backward-compatibility readers, migrations, redirects, aliases, or old-name
  and old-storage fallbacks.
- **Route invariant** — the styleguide-only root build emits 82 HTML routes
  (zfb reports 84 pages when `/robots.txt` and `/sitemap.xml` are included). Do not
  remove provider guides or unrelated routes while cleaning product ownership.

See `packages/ui/STORIES.md` §10, `packages/ui/README.md`, and
`ui-provider-handoff.json` for the permanent provider contract.

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
