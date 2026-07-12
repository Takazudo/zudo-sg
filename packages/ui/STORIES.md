# Story-authoring contract (`@zudo-sg/ui`)

This document is the **source of truth** for how `*.stories.tsx` files in this
package are written and how the S6 styleguide catalog discovers and renders
them. The TypeScript shapes referenced here live in
[`src/stories/types.ts`](./src/stories/types.ts) (re-exported from the package
root). Keep this doc and that file in sync.

If you are building the catalog (S6): everything you need to write the registry
is here. You should not have to guess.

---

## 1. How the package is consumed: **from source**

`@zudo-sg/ui` has **no build step**. Its `package.json` points `main` and the
`"."` export at `src/index.ts` directly:

```jsonc
"main": "./src/index.ts",
"exports": {
  ".": "./src/index.ts",
  "./styles/tokens.css": "./styles/tokens.css",
  "./styles/colors.css": "./styles/colors.css"
}
```

Consumers (the root styleguide host and `apps/demo`) import the `.tsx`/`.ts`
source and let **their own** Vite/zfb pipeline transpile it. There is nothing to
compile or publish before consuming. Two consequences for the catalog:

1. The catalog imports components and stories as source — no `dist/` lookup.
2. The catalog's own Tailwind build must **scan this package's source** so the
   utility classes the components emit are generated. Add a content source:

   ```css
   @source "../../packages/ui/src/**/*.{tsx,ts,jsx,js}";
   ```

   (Adjust the relative prefix to the catalog's CSS location. The demo does
   exactly this in `apps/demo/styles/global.css`.)

### Required style imports

Components reference **semantic token utilities only** (`bg-brand`, `text-ink`,
`border-line`, `bg-surface-sunken`, `shadow-card`, `gap-vsp-md`, …). Those
utilities exist only if the consumer imports both shared token files **after**
Tailwind's preflight + utilities, in this order:

```css
@import "tailwindcss/preflight";
@import "tailwindcss/utilities";
@import "@zudo-sg/ui/styles/tokens.css";   /* spacing, type, radius, shadow */
@import "@zudo-sg/ui/styles/colors.css";   /* semantic colors, light + dark  */
```

`colors.css` sets `color-scheme: light dark` on `:root` and declares every color
with `light-dark()`, so **components are dark-mode correct with no per-component
work**. A host that wants a manual toggle pins the scheme with
`:root[data-theme="light"|"dark"]` (overrides already in `colors.css`); no
component markup changes.

#### Three-tier color system

Colors follow the **three-tier strategy** (zudo-css-wisdom: *Three-Tier Color
Strategy*) — the same shape as zudo-doc's `--palette-*` ramps feeding semantic
roles:

| Tier | What | Where |
|---|---|---|
| **1 — Palette** | Raw oklch values, named `--palette-{group}-{step-or-role}` (groups `base`, `accent`, and `state`) | `styles/colors.css` (top `:root` block) |
| **2 — Semantic** | Roles → palette: `--color-*` tokens are semantic values backed by palette refs, with a few zudo-doc-style AA-tuned light-mode literals | `styles/colors.css` (`@theme`) |
| **3 — Component** | Scoped overrides — rarely needed under Tailwind utilities | per-component |

**The palette is raw and is NEVER referenced directly by components.** Components
bind only to the semantic `--color-*` Tailwind utilities (`bg-brand`,
`text-ink`, `border-line`, …). The palette lives in a plain `:root` block (**not
`@theme`**) on purpose: a `@theme` entry would make Tailwind emit
`bg-palette-*`/`text-palette-*` utilities, letting a component bypass the
semantic layer — plain `:root` vars still resolve through `var()` inside the
`@theme` semantic declarations, so no palette utility is ever generated.

Both tiers live in **`colors.css`** — the Tier-1 palette is inlined at the top
of that file, the Tier-2 `@theme` block follows. It is deliberately **not** split
into a sibling `palette.css`: the **single consumer import contract** requires
every consumer to do exactly one `@import "@zudo-sg/ui/styles/colors.css"`, and
the consumer Tailwind/Lightning pipeline inlines that package import's contents
but leaves a *nested* relative `@import "./palette.css"` as a literal, misplaced
`@import` that the browser then ignores — silently dropping the palette. Inlining
keeps both tiers in the one bundled file. There is no separate `palette.css`
export, and consumers must not add one. Changing the brand color, or swapping the
whole palette, is a one-file edit in `colors.css` (the palette block, or a remap
of the Tier-2 pointers) — component CSS never changes.

---

## 2. File location & discovery mechanism

Two directory layouts co-exist and are discovered by the same mechanism:

- **One-level (original)**: `src/<component>/<name>.stories.tsx` — e.g.
  `src/button/button.stories.tsx`. Every component shipped before #224 uses
  this layout; it is not being migrated as part of #224.
- **Category-nested (current convention for new components)**:
  `src/<category-slug>/<component>/<name>.stories.tsx` — e.g.
  `src/layout/badge-icon/badge-icon.stories.tsx`. `<category-slug>` is the
  lowercase, hyphenated form of the component's `StoryCategory` (see §3),
  e.g. `"Data Display"` → `data-display`. A component's own directory name
  must still equal its story stem (`badge-icon/badge-icon.stories.tsx`, not
  `badge-icon/story.stories.tsx`) — same one-dir-per-component rule as the
  original layout, just with one more directory level in front of it.

Two different categories MAY scaffold a same-named component (e.g.
`layout/badge/` and `forms/badge/`) — the catalog keys everything off the full
directory path, never the bare component name, so this produces two distinct,
independently-addressable catalog entries rather than a collision (see the
codegen details below).

- **Naming:** always `*.stories.tsx` (the `.stories` infix is the discovery key).
- **Discovery is codegen, not `import.meta.glob`.** zfb does not statically
  inline `import.meta.glob` — the literal call survives into the shared client
  islands bundle and throws in the browser (`import.meta.glob` is undefined
  there). So the catalog cannot use a runtime glob at all. Instead,
  [`scripts/gen-sg-registry.mjs`](../../scripts/gen-sg-registry.mjs) (repo
  root) globs `packages/ui/src/**/*.stories.tsx` (any depth — both layouts
  above) **on the filesystem at codegen time** and regenerates two
  explicit-import lists from what it finds:

  - `src/styleguide/data/sg-registry.ts` (repo root) — the catalog's
    path→module registry.
  - the `GENERATED:SG_REGISTRY_BEGIN`…`END` block in
    [`src/stories/__tests__/story-modules.ts`](./src/stories/__tests__/story-modules.ts)
    — the shared `STORY_MODULES` registry imported by `contract.test.ts` and
    `source-drift.test.ts`.

  Both generated blocks are byte-identical in shape to what a real
  `import.meta.glob({ eager: true })` would have produced, just computed ahead
  of time instead of at runtime.

  **Identifier derivation (why two `badge`s don't collide):** each entry's
  `import * as <name>` identifier is derived from its FULL relative directory
  path (every path segment, hyphen-joined then camelCased), not from the file
  stem alone. A one-level component's directory is a single segment, so this
  is byte-identical to what the generator always produced (`badge/` →
  `badge`). A category-nested component's directory is two segments, so
  `layout/badge/` → `layoutBadge` and `forms/badge/` → `formsBadge` — distinct
  identifiers, both entries present in the generated map, neither silently
  overwriting the other. The generator also asserts every derived identifier
  is unique across the whole discovery pass and throws (no write) if it ever
  finds two directories that fold to the same one — see
  `scripts/__tests__/gen-sg-registry.test.ts`.

- **After adding, renaming, or removing a story file**, run
  `pnpm gen:sg-registry` from the repo root and commit the regenerated files.
  `pnpm check:sg-registry` (wired into CI and `scripts/run-b4push.sh`) fails
  the build if the generated blocks drift from what's on disk — forgetting to
  regenerate is a build failure, not a silently-missing catalog entry.
- **Never hand-edit** between the `GENERATED:SG_REGISTRY_BEGIN`/`END` markers
  in either generated file; the next `pnpm gen:sg-registry` run overwrites it.

### The barrel transition rule — new components stay OUT of the barrel

`packages/ui/src/index.ts` (the barrel) is a **one-level-layout artifact**: its
export names come straight from the original flat components (`Card`, `Hero`,
`SiteHeader`, …). New, category-nested components being ported in from
elsewhere may reuse those exact names for unrelated components (a different
`Card`, a different `Hero`), which would collide if barrel-exported under the
same identifier.

**Rule: a component scaffolded into the category-nested layout is never added
to the barrel.** It's still fully catalog-visible and testable — the registry
(`sg-registry.ts` / `story-modules.ts`) imports every story via its package
subpath (`@zudo-sg/ui/src/<category>/<name>/<name>.stories.tsx`), **never**
via the barrel — but consumers of `@zudo-sg/ui`'s top-level export can't reach
it yet. This is intentional and temporary: a later "atomic swap" sub-issue
rebuilds the barrel from scratch once every new component has landed and the
old ones are retired, resolving the name collisions in one pass instead of
piecemeal. Until that lands, `pnpm new:component --nested` (§8) never touches
`packages/ui/src/index.ts`, and hand-adding a nested component's export to the
barrel is a bug, not a workaround.

---

## 3. Module shape

Every `*.stories.tsx` exports **exactly**:

- a **default export** `meta: StoryMeta`, and
- **one or more named exports**, each a `Story<P>` (below).

Nothing else should be exported. The registry treats `default` as the meta and
**every other own enumerable export** as a story. (Matches the `StoryModule`
type.)

### `meta` (default export) — `StoryMeta`

```ts
const meta: StoryMeta = {
  title: "Button",            // display name; unique within a category
  category: "Actions",        // sidebar bucket (closed set, see below)
  description: "Primary action control with three variants and three sizes.",
  usage: `import { Button } from "@zudo-sg/ui";\n\n<Button>Save</Button>`,
  order: 1,                   // optional; lower sorts earlier within a category
};
export default meta;
```

| field         | type            | required | meaning |
|---------------|-----------------|----------|---------|
| `title`       | `string`        | yes      | Component display name; unique within its category. |
| `category`    | `StoryCategory` | yes      | Top-level sidebar group. **Closed set** (below). |
| `description` | `string`        | yes      | One sentence under the title. |
| `usage`       | `string`        | yes      | Verbatim import + minimal JSX, shown in a code block. Plain string so the catalog renders it as-is. |
| `order`       | `number`        | no       | Sort hint within a category; alphabetical by `title` when omitted. |

**`StoryCategory` is a closed union** — use one of:
`"Actions" | "Typography" | "Layout" | "Data Display" | "Forms" | "Navigation" |
"Content" | "Landing" | "News" | "Search" | "Feedback" | "Media"`.
Adding a category means editing `StoryCategory` in `src/stories/types.ts` (so the
catalog and the authors share one list). The catalog should render categories in
the union's declared order.

This field is the sidebar bucket only — it is **independent of the directory
layout** in §2. A category-nested component's directory slug (`layout/`,
`data-display/`, …) is usually derived from its `category`, but nothing
enforces that the two match; a component's `meta.category` is what the
catalog groups by, full stop.

### Named exports — `Story<P>`

`Story` is **generic over the driving component's props** — `Story<ButtonProps>`,
`Story<CardProps>`, etc. — so a variant's `controls` (see §4) are checked
against the component's real props: `prop` must name an actual key of `P`, and
where `P` is informative (e.g. a prop typed as a string-literal union),
`options`/`defaultValue` are restricted to that union too. `P` defaults to
`Record<string, unknown>`, so the bare `Story` name still works — reach for it
when a variant has no `controls` to check, or its `render` composes more than
one component's props (no single `P` fits).

```ts
export const Variants: Story<ButtonProps> = {
  name: "Variants",                 // variant label shown above the preview
  render: () => (<div>…</div>),      // pure, synchronous; returns the preview node
  controls: [                       // optional; metadata only (see §4)
    { type: "select", prop: "variant", label: "Variant",
      options: ["primary", "secondary", "ghost"], defaultValue: "primary" },
  ],
  source: `<Button>Primary</Button>`, // optional; verbatim code panel (see §5)
};
```

| field      | type                | required | meaning |
|------------|---------------------|----------|---------|
| `name`     | `string`            | yes      | Variant label. Unique within the file. |
| `render`   | `(args?: Partial<P>) => VNode` | yes | **Pure, synchronous.** Returns the preview node. `args` is the merged control values, typed to `P` — no `as` cast needed. No effects, no async, no data fetching. |
| `controls` | `StoryControl<P>[]` | no       | Declarative knob descriptors, keyed to real props of `P`. Metadata only — see §4. |
| `source`   | `string`            | no       | Verbatim JSX for the code panel — see §5. |

If the component's `Props` type isn't exported, derive it inline rather than
widening the component's public surface just for story typing:
`type ButtonProps = Parameters<typeof Button>[0];`. For a `render` that
composes more than one component into one scene (e.g. `Card` +
`CardTitle`/`CardBody`/`CardFooter`), define a small scene-specific args type
instead of forcing a single component's `Props` — see `card.stories.tsx` →
`Playground`.

The optional `defineStory(story)` identity helper (exported from the package)
just pins the type for editor autocomplete; a plain object literal that
satisfies `Story<P>` is equally valid.

---

## 4. Controls convention (optional, metadata-only)

`controls` **describes** the knobs a variant could expose; it does **not** wire
them. The catalog decides whether and how to render live controls. A story with
no `controls` renders fine — it's a static preview. This keeps story authoring
trivial and pushes interactivity entirely into the catalog (S6's call).

`StoryControl<P>` is a discriminated union on `type`:

```ts
{ type: "select",  prop: "variant", label: "Variant", options: ["primary","ghost"], defaultValue: "primary" }
{ type: "boolean", prop: "block",   label: "Full width", defaultValue: false }
{ type: "text",    prop: "label",   label: "Label", defaultValue: "Click me" }
```

- `prop` is typed `keyof P & string` — it must name a **real** prop of the
  component the `Story<P>` is parameterized over. Rename or remove that prop
  and every control naming it fails to typecheck.
- `defaultValue` (and `options`, for `select`) narrow to that prop's own value
  type where `P` is informative — e.g. `variant`'s `select` control above only
  accepts values from `ButtonVariant`, so a typo or a since-removed variant
  name fails to typecheck too.
- If the catalog implements live controls, it is responsible for re-invoking
  `render` (or re-rendering the component) with the chosen values — the contract
  does not prescribe a binding mechanism, only the descriptor shape. Treat
  `controls` as a hint for catalog UI, not a guarantee that `render` reads them.

---

## 5. Source extraction

The catalog shows a code panel per variant. Resolution order:

1. **Explicit `source`** — if a `Story` sets `source`, the catalog shows that
   string **verbatim** (recommended for variants whose `render` body is
   non-obvious, e.g. a `.map()` over tones). This is the reliable path.
2. **Fallback to `meta.usage`** — if a variant has no `source`, the catalog may
   show `meta.usage` as the component-level example.
3. **No automatic AST extraction is promised.** Because the package is consumed
   from source, a catalog *could* read the raw `.stories.tsx` text and slice out
   a variant's `render` body, but the contract does **not** require authors to
   keep `render` extractable, and does not require the catalog to implement it.
   Authors who want an exact code panel set `source`.

**Authoring guidance:** set `source` on any variant whose rendered markup is not
a one-liner. The starter stories follow this (see `button.stories.tsx` →
`Variants`).

---

## 6. Browser-only / MSW / data rules

The catalog renders stories during a **static build** (zfb). Therefore:

- **`render` must be pure and synchronous.** No `useEffect`, no top-level
  `await`, no network calls, no timers, no reliance on `window`/`document` at
  render time. A story that needs a browser API will break the static build.
- **No data fetching, no MSW.** The starter set is presentational; there is no
  network dependency and **no MSW handler requirement**. If a future component
  needs mocked data, supply it as **inline props/fixtures inside `render`** —
  do not introduce request mocking into the story layer. If a component is
  genuinely browser-only (needs runtime JS, e.g. a dialog with focus-trap),
  document it in the story `description` and keep the default `render` a static,
  SSR-safe representation; the catalog can layer interactivity separately.
- **Self-contained markup.** A `render` must not depend on ambient page chrome
  (sticky offsets, global providers). Where a component is normally sticky/fixed
  (e.g. `SiteHeader`), pass the prop that disables it in the story
  (`sticky={false}`) so it sits inside the catalog cell — the starter
  `site-header.stories.tsx` does this.

### The `previewRoute` escape hatch — real page, not `render`, not the variant iframe

Some components can only be honestly demoed on a real, live-fetching page — a
flow that hits an endpoint, a dialog wired into a real form submission, a
widget that genuinely needs mocked network responses to be useful. `render`
cannot do this (it must stay pure/synchronous/no-MSW, per the rules above).

`previewRoute` is **not** the same mechanism as the catalog's built-in variant
iframes. Every `Story` the catalog renders is already shown inside an
isolated `/components/preview` iframe (`PREVIEW_ROUTE_PATH`, wired in
`src/features/styleguide/preview/route.ts` + `variant-frame.tsx`) — that
iframe always re-invokes one of THIS file's own `Story.render` functions, for
the catalog's live-controls/CSS-injection pipeline. `previewRoute` is a
**different, separate thing**: an optional `StoryMeta` field that names a REAL
page route the author builds and owns themselves (e.g.
`pages/preview/<component>.tsx` serving `/preview/<component>`), completely
outside the `render`/variant-iframe system. When set, the catalog surfaces it
as a plain, visible "Live demo" link to that page — not an embedded frame.

Rules:

- **`render` stays pure/synchronous/no-MSW, exactly as required above.**
  Adding a `previewRoute` never changes that — it's an escape hatch alongside
  `render`, not a way to relax it.
- **MSW (or any other request mocking) is permitted only inside the page(s)
  reachable via `previewRoute`, scoped to that route.** It must **never** be
  imported into any `*.stories.tsx` file or any component source under
  `packages/ui/src` — mocking lives entirely in the demo page, not the
  library or the story layer.
- `previewRoute` must be a real, same-origin page path starting with `/`
  (e.g. `/preview/dialog-with-fetch`) — not a `//protocol-relative` URL, not
  a `PREVIEW_ROUTE_PATH` / variant-iframe URL, and not a `render`-produced
  node.

Minimal `meta` example:

```ts
const meta: StoryMeta = {
  title: "DialogWithFetch",
  category: "Forms",
  description: "Dialog that loads its content from a live endpoint.",
  usage: `import { DialogWithFetch } from "@zudo-sg/ui";\n\n<DialogWithFetch />`,
  previewRoute: "/preview/dialog-with-fetch", // real page; MSW lives here only, never in render()
};
export default meta;
```

---

## 7. Authoring checklist

When adding a component, ship its story in the same change:

- [ ] `src/<component>/<component>.stories.tsx` exists (co-located).
- [ ] Default export is a `StoryMeta` with `title`, `category` (from the closed
      set), `description`, `usage`.
- [ ] At least one named `Story<P>` export (`P` = the component's props) with
      `name` + pure synchronous `render`.
- [ ] `source` set on any non-trivial variant.
- [ ] `controls` added where live editing is meaningful (optional); `prop`
      names a real key of `P`.
- [ ] Component uses only semantic token utilities (passes `pnpm lint:tokens`).
- [ ] _(Optional)_ `src/<component>/<component>.mdx` docs file, if the component
      needs guidelines / do-don't / a11y notes beyond `description` + `usage`
      (see §8).
- [ ] `pnpm check` (typecheck) and `pnpm test:unit` pass.

---

## 8. Scaffolding a new component

`pnpm new:component <name> --category <Category>` (repo root) generates the
whole checklist above in one command, in either directory layout from §2:

```
# One-level (only meaningful for the pre-#224 flat components; not used for
# new components going forward — see the barrel transition rule in §2):
pnpm new:component demo-widget --category Layout

# Category-nested (current convention — packages/ui/src/<category-slug>/<name>/):
pnpm new:component demo-widget --category Layout --nested
```

- `<name>` must be kebab-case.
  - Flat mode: must not already exist under `packages/ui/src/`.
  - `--nested` mode: must not already exist under
    `packages/ui/src/<category-slug>/` — the SAME name in a DIFFERENT
    category is fine (that's the point of category-nesting; see §2).
- `<Category>` must be one of the `StoryCategory` union members (§3):
  `Actions`, `Typography`, `Layout`, `Data Display`, `Forms`, `Navigation`,
  `Content`, `Landing`, `News`, `Search`, `Feedback`, `Media`.
- `--nested` scaffolds into `packages/ui/src/<category-slug>/<name>/` instead
  of the flat `packages/ui/src/<name>/`, where `<category-slug>` is
  `<Category>` lowercased with spaces replaced by hyphens (e.g.
  `"Data Display"` → `data-display`). A nested scaffold **never** touches the
  barrel (`packages/ui/src/index.ts`), regardless of `--skip-barrel` — see
  the transition rule in §2.
- `--skip-barrel` (optional, flat mode only) skips the barrel-export insert
  step (below) — use it when you want to add the export by hand, e.g. to
  place it in a non-default position. It's a no-op alongside `--nested`
  (nested scaffolds already always skip the barrel).

It creates, following the existing house pattern (variant union + `Record`
class map + `class?` passthrough + the shared focus-visible outline classes):

- `packages/ui/src/<name>/<name>.tsx` (or, nested,
  `packages/ui/src/<category-slug>/<name>/<name>.tsx`) — typed-props component
  skeleton.
- …`/<name>.stories.tsx` — `StoryMeta` + a typed `Story<Props>` `Playground`
  variant with a controls skeleton (§3/§4).
- …`/__tests__/<name>.test.tsx` — a starter test suite.
- The barrel export in `packages/ui/src/index.ts`, inserted alphabetically
  into the matching `// ── <Category> ──` section — **flat mode only**,
  unless `--skip-barrel` is passed or this project has no barrel-file
  convention (see below). `--nested` always skips this step.
- A `gen:sg-registry` run, so the component is registered in the S6 catalog
  immediately (§2) — no separate step needed, for either layout.

The generated files typecheck, pass `lint:tokens`, and pass the story-authoring
contract test as-is (the two placeholder `variant`s exist so nothing is
half-typed). Fill in the `TODO`s — the real markup, variant classes, and
description — then run `pnpm check` and `pnpm test:unit` before shipping.

The scaffolder's own logic (name/category validation, the category→slug
mapping, templates, and the barrel-insertion algorithm) lives in
`scripts/lib/component-scaffold.mjs` and is unit-tested in
`scripts/__tests__/component-scaffold.test.ts`; the CLI entry point is
`scripts/new-component.mjs`.

### Configuring the scaffolder (a fork with a different layout)

`scripts/lib/scaffold-config.mjs` is the single source of truth both
`new-component.mjs` and `gen-sg-registry.mjs` read from:

- `COMPONENTS_ROOT` (default `"packages/ui/src"`) — the directory scanned/
  written to for `<name>/<name>.{tsx,stories.tsx}`.
- `BARREL_INDEX` (default `"packages/ui/src/index.ts"`) — the barrel file
  new-component.mjs inserts an `export { … }` block into. Set to `null` if a
  project has no barrel-file convention; new-component.mjs then always skips
  the insert step, same as always passing `--skip-barrel`.
- `UI_PACKAGE_NAME` (default `"@zudo-sg/ui"`) — the npm package name used in
  generated `usage` snippets and in the package-scoped import specifiers
  `gen-sg-registry.mjs` emits into `src/styleguide/data/sg-registry.ts`. If
  `COMPONENTS_ROOT` moves, keep `packages/ui/package.json`'s `exports` map
  wildcard (`"./<basename>/*": "./<basename>/*"`) matching the new root's
  basename — `gen-sg-registry.mjs` derives its package-scoped import root
  from `UI_PACKAGE_NAME` + that basename.

## 9. Per-component docs (optional MDX)

`meta.description` (one sentence) and `meta.usage` (one snippet) cover the quick
reference. When a component needs more — usage guidelines, do/don't, variant
intent, accessibility notes — ship an **optional** co-located MDX doc:

```
src/<component>/<component>.mdx      # e.g. src/button/button.mdx
# or, in the category-nested layout:
src/<category-slug>/<component>/<component>.mdx
```

- **Optional and co-located.** Same directory + base name as the component and
  its story (`button.tsx`, `button.stories.tsx`, `button.mdx`). A component with
  no `.mdx` renders no extra section on its detail page — nothing else to do.
- **How it renders.** The doc is a
  [`componentDocs`](../../zfb.config.ts) content collection rooted at
  `packages/ui/src` (`include: ["**/*.mdx"]` — the globset `**` matches zero
  or more directory components, so one pattern covers both the flat and
  category-nested layouts), so zfb's Rust pipeline compiles it at build time.
  The host detail page (`pages/components/[slug].tsx`) looks up the entry by
  deriving its slug from the story path
  ([`src/styleguide/data/component-docs.ts`](../../src/styleguide/data/component-docs.ts))
  and renders `<entry.Content>` inside a `.zd-content` wrapper. Discovery is
  therefore keyed off the **same** `packages/ui/src/` root the `gen-sg-registry`
  codegen walks, at whatever depth the story lives — no separate registration,
  no codegen change.
- **Authoring.** Start headings at `##` (the page title is already the `<h1>`).
  The shared doc typography (`.zd-content`), fenced code-block highlighting, and
  the admonition directives all work exactly as in a regular doc page:

  ```md
  ---
  title: Button
  ---

  ## Guidelines

  Prose, lists, and fenced code blocks render with the site's doc styles.

  :::tip
  Admonitions (`:::note` / `:::tip` / `:::info` / `:::warning` / `:::danger` /
  `:::caution`) and the `<Note title="…">` JSX form both render.
  :::
  ```

- **Not a route.** The collection is intentionally absent from
  `resolveMarkdownLinks.dirs`, so these files never get their own URL — they
  only ever render inline on the component detail page.
