# Zudo Sg Docs

Documentation site built with [zudo-doc](https://github.com/zudolab/zudo-doc) — a zfb-based documentation framework with MDX, Tailwind CSS v4, and Preact islands.

## Tech Stack

- **zfb** — documentation build framework
- **MDX** — content format
- **Tailwind CSS v4** — via `@tailwindcss/vite`
- **Preact** — for interactive islands only (with compat mode for React API)
- **syntax highlighting** — built-in class-mode code highlighting, run by zfb's Rust pipeline at build time: fences render as semantic `hi-*` token classes under `pre.hi-root`, mapped to design tokens via `@takazudo/zudo-doc/features.css`'s `--zfb-hi-*` bridge — no project-owned renderer or theme config required (zudo-doc 4.x)

## Commands

- `pnpm dev` — zfb dev server (port 4323)
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
- Use **Preact islands** only when client-side interactivity is needed

## Enabled Features

- **search** — Full-text search via Pagefind
- **sidebarFilter** — Real-time sidebar filtering
- **claudeResources** — Auto-generated docs for Claude Code resources
- **llmsTxt** — Generates llms.txt for LLM consumption
