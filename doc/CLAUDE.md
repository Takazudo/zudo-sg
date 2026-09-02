# Zudo Sg Docs

This workspace is the contributor documentation site built with zudo-doc 5.16, zfb, MDX, Tailwind CSS v4, and Preact.

## Commands

- `pnpm dev` — start zfb on port 4323.
- `pnpm check` — typecheck config, routes, and MDX.
- `pnpm build` — generate the static site in `dist/`.
- `pnpm check:html` — validate generated HTML after a build.
- `pnpm setup:doc-skill` — generate and link the `doc-wisdom` skill.

Run commands from `doc/`, or use the `@zudo-sg/doc` workspace filter from the repository root.

## Scaffold ownership

- Keep site choices in `zfb.config.ts` inside the single `defineConfig(zudoDoc({ ... }))` call.
- Keep only the package index re-export and the canonical self-contained docs catch-all under `pages/`.
- Package exports own doc chrome, route context, navigation, schemas, translations, color schemes, content components, and feature islands. Do not recreate a local `pages/lib` chain.
- `src/styles/global.css` starts with the canonical 5.2 scaffold imports. Add only intentional project-specific token or content overrides after them.
- `src/content/docs/` contains the 12 authored articles. Generated Claude-resource directories under `src/content/docs/claude*` are not hand-authored.

## Content conventions

- Frontmatter requires `title`; use `sidebar_position` to control ordering and `description` when it improves metadata or search.
- Do not add an h1 in the body; the frontmatter title renders it. Start sections at h2.
- Use relative `.md`/`.mdx` links for authored documentation.
- Directive admonitions such as `:::note` are available without imports.
- Prefer server-rendered JSX. Add a Preact island only for required client behavior and keep its page import chain statically discoverable.

## Enabled behavior

Search, image enlargement, dynamic page transitions, `llms.txt`, and repository-root Claude resources are enabled. AI chat, history, design-token panels, local versioning, tags, changelogs, sidebar resizing/toggling, and HTML preview are disabled.
