# Zudo Sg

Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **zfb** — documentation build framework
- **MDX** — content format
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands only (with compat mode for React API)
- **syntect** — built-in code highlighting, run by zfb's Rust pipeline at build time (single fixed theme: `base16-ocean-dark`)

## Commands

- `pnpm dev` — zfb dev server (port 4321)
- `pnpm build` — static HTML export to `dist/`
- `pnpm check` — TypeScript type checking

## Key Directories

```
src/
├── components/          # JSX + Preact components
│   └── admonitions/     # Note, Tip, Info, Warning, Danger
├── config/              # Settings, color schemes
├── content/
│   └── docs/            # MDX content
├── layouts/             # JSX layouts
├── pages/               # File-based routing
└── styles/
    └── global.css       # Design tokens & Tailwind config
```

## Content Conventions

### Frontmatter

- Required: `title` (string)
- Optional: `description`, `sidebar_position` (number), `category`
- Sidebar order is driven by `sidebar_position`

### Admonitions

Available in all MDX files without imports: `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Danger>`
Each accepts an optional `title` prop.

### Headings

Do NOT use h1 (`#`) in doc content — the page title from frontmatter is rendered as h1. Start content headings from h2 (`##`).

## Components

- Default to **server-rendered JSX components** (`.tsx`) — zero JS, server-rendered
- Use **Preact islands** (`client:load`) only when client-side interactivity is needed

## Monorepo Structure

This is a pnpm workspace monorepo:

- **Root (`.`)** — the zudo-doc styleguide host
- **`packages/ui`** (`@zudo-sg/ui`) — shared Preact component library
- **`apps/demo`** (`@zudo-sg/demo`) — static demo site (Tailwind v4, no SSR)

To build all packages: `pnpm install && pnpm build` (root only; apps/demo builds with `pnpm --filter @zudo-sg/demo build`).

## Enabled Features

- **search** — Full-text search via Pagefind
- **sidebarFilter** — Real-time sidebar filtering
- **imageEnlarge** — Click-to-enlarge images
- **claudeResources** — Auto-generated docs for Claude Code resources
- **claudeSkills** — Ships zudo-doc-design-system, zudo-doc-translate, zudo-doc-version-bump skills
- **designTokenPanel** — Interactive tabbed panel for tweaking spacing, font, size, and color tokens
- **sidebarResizer** — Draggable sidebar width
- **sidebarToggle** — Show/hide desktop sidebar
- **versioning** — Multi-version documentation support
- **llmsTxt** — Generates llms.txt for LLM consumption
- **skillSymlinker** — Links doc content into Claude Code skill via `pnpm setup:doc-skill`
- **footerNavGroup** — Footer navigation link groups
- **footerCopyright** — Footer copyright notice
- **changelog** — Changelog page at `/docs/changelog`
