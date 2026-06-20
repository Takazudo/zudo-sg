# Styleguide catalog (S6 infrastructure)

The component catalog that discovers and presents every `@zudo-sg/ui`
`*.stories.tsx` story, served on the zudo-doc host under `/sg`.

This document records the **architecture + the load-bearing decisions**. The
story-authoring contract it consumes is `packages/ui/STORIES.md`.

---

## Story discovery — eager `import.meta.glob` (no codegen)

**Chosen mechanism: rung #1 of the issue's fallback ladder — eager
`import.meta.glob`.** No codegen prebuild, no separate zfb sub-package.

The registry lives at **`packages/sg-registry.ts`**:

```ts
export const storyModules = import.meta.glob<StoryModule>(
  "./ui/**/*.stories.tsx",
  { eager: true },
);
```

zfb 0.1.0-next.53 expands eager `import.meta.glob` at SSR render time, so every
story module's `meta` + variant exports are available synchronously. Verified:
all 10 stories / ~30 variants discovered with metadata intact.

### Why `packages/sg-registry.ts` and not the literal repo root

`STORIES.md` specifies "the registry lives at the repo root" with pattern
`./packages/ui/**/*.stories.tsx`. The S6 discovery spike found two hard zfb
bundler constraints that shape *where* the registry can physically live:

1. **`../` parent-relative glob patterns are rejected outright** — zfb errors
   with `parent-directory (../) patterns are not supported`. So the registry
   cannot sit inside `packages/ui` and glob out with `../`.
2. **Only known top-level dirs are materialised into the esbuild shadow tree**
   (`pages/`, `src/`, `packages/`, `apps/`). A bare file at the literal repo
   root (`/registry.ts`) is never bundled — esbuild reports
   `Could not resolve`.
3. **The glob base is the importer's directory** — a root-relative
   `./packages/ui/**` pattern from a file under `src/` silently matches zero
   files (it looks for `src/.../packages/ui`, which doesn't exist).

`packages/` is the materialised root of the `ui` workspace and the closest
ancestor of `ui/` that satisfies all three constraints. So
`packages/sg-registry.ts` + the no-`../` pattern `./ui/**/*.stories.tsx` is the
**functional equivalent of the STORIES.md "root-level registry" intent** — same
file set, eager, SSR-resolved, zero `../`.

### If eager glob ever breaks

Fall back to ladder rung #2: a prebuild codegen script (zzmod's
`scripts/generate-story-glob.mjs` pattern) that scans
`packages/ui/**/*.stories.tsx` and emits a static-import module exposing the
same `storyModules` shape. Only `packages/sg-registry.ts` would change — the
consumer (`src/styleguide/data/registry.ts`) keys off the path→module map.

The macro has **no shipped TypeScript declaration** in zfb, so a one-form
ambient shim lives at `src/styleguide/import-meta-glob.d.ts` (otherwise
`pnpm check` reports TS2339).

---

## Routes

| Route          | File                      | Purpose |
|----------------|---------------------------|---------|
| `/sg`          | `pages/sg/index.tsx`      | Catalog landing, stories grouped by `meta.category`. |
| `/sg/[slug]`   | `pages/sg/[slug].tsx`     | Component detail: stacked variant previews + code panel. `paths()` enumerates one route per discovered story. |
| `/sg/tokens`   | `pages/sg/tokens.tsx`     | Read-only design-token reference (color / spacing / type). |
| `/sg/preview`  | `pages/sg/preview.tsx`    | Chrome-free page loaded inside each variant iframe. |

## Features (`src/styleguide/`)

- **`chrome/`** — the 3-region shell (`styleguide-layout.tsx`): header + left
  sidebar + main + optional right code panel. Resizable left/right panels with
  localStorage persistence (`panel-contract.ts` constants + `panel-scripts.tsx`
  pre-paint restore & drag-resize). Visibility toggles via `<html>`
  data-attributes; widths via CSS custom properties.
- **`preview/`** — isolated variant previews. Each `VariantFrame` (parent side)
  hosts a same-origin `<iframe src="/sg/preview?slug=…&variant=…">`; `PreviewApp`
  (inside the iframe) resolves the variant from `location.search`, renders it
  client-side from the eager-glob registry, and reports its height back over a
  `postMessage` protocol (`messages.ts`). Same-origin iframes give CSS isolation
  while still receiving the main CSS bundle.
- **`code-panel/`** — CodeMirror panel. A read-only source view per variant
  (verbatim `Story.source`, falling back to `meta.usage` — the only source the
  contract promises; the host's SSG runtime has no `node:fs` and zfb has no
  `?raw` glob) plus an **editable live-CSS buffer** that injects, debounced,
  into every preview iframe (`css-injection.ts`). The heavy `@codemirror/*`
  graph is pulled only via a dynamic `import()` (`editor-setup.ts`) so it never
  reaches zfb's SSR platform.
- **`token-tweak/`** — bridges the existing `@takazudo/zdtp` tweaker to the
  previews. `preview-iframe-registry.ts` observes the live `--*` overrides zdtp
  writes on `<html>` and broadcasts them to every registered preview iframe via
  zudo-doc's theme iframe-bridge (`apply-css-vars`). The header "Tokens" button
  opens the same zdtp panel the docs site uses.

## What is S7, not built here

Search/filter, copy-to-clipboard, an interactive `/tokens` playground, expanded
metadata, render-arg binding for the controls panel (the channel is wired; the
starter stories' `render()` ignore props per STORIES.md §4), and a per-component
`.tsx` source view (needs codegen — not achievable from the SSG runtime).

## Dev-save plugin

**Not added.** The code panel's live-CSS-injection is fully client-side and the
source view is read-only, so no `/api/save-source` `devMiddleware` endpoint is
needed. (zzmod's dev-save wrote edited component source back to disk; that would
also conflict with treating `packages/ui` as a read-only contract.)

## Necessary host edits

`src/styles/global.css` gained two additive blocks (no S2 token definitions
changed):

1. `@import "@zudo-sg/ui/styles/colors.css"` — so the catalog can render the UI
   components (they emit `bg-brand` / `text-ink` / `border-line` / … utilities
   that only exist if these tokens are declared). The four token names that
   overlap the host palette (`surface`/`accent`/`success`/`danger`) are
   re-asserted to the host's `var(--zd-*)` values by the existing `@theme`
   block, so **the docs site is unchanged**.
2. `@source` directives for `src/styleguide/**` and `packages/ui/src/**` so
   Tailwind generates the utility classes the components emit.
