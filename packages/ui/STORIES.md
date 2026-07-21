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

Components reference **semantic token utilities only** (`bg-accent`, `text-fg`,
`border-border`, `bg-surface-2`, `shadow-card`, `gap-vsp-md`, …). Those
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

For a manual demo-site toggle, use the reusable exports rather than creating a
second theme state implementation. Emit `THEME_PREPAINT_SCRIPT` in the document
head before visible styles, then mount `<ThemeControl />` where the host's chrome
needs it. The only persisted values are `light` and `dark`, under the public
`zudo-sg-demo-theme` storage key; the root attribute is the runtime source of
truth and the light fallback is safe when storage is unavailable.

#### Three-tier color system

Colors follow the **three-tier strategy** (zudo-css-wisdom: *Three-Tier Color
Strategy*) — the same shape as zudo-doc's `--palette-*` ramps feeding semantic
roles:

| Tier | What | Where |
|---|---|---|
| **1 — Palette** | Raw oklch values, named `--palette-{group}-{step-or-role}` (the locked four-stop `neutral` group plus `accent`, `state`, and `line-*` groups) | `styles/colors.css` (top `:root` block) |
| **2 — Semantic** | Roles → palette: `--color-*` tokens are semantic values backed by palette refs, with a few zudo-doc-style AA-tuned light-mode literals | `styles/colors.css` (`@theme`) |
| **3 — Component** | Scoped overrides — rarely needed under Tailwind utilities | per-component |

**The palette is raw and is NEVER referenced directly by components.** Components
bind only to the semantic `--color-*` Tailwind utilities (`bg-accent`,
`text-fg`, `border-border`, …). The palette lives in a plain `:root` block (**not
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

[`TOKEN-MAP.md`](./TOKEN-MAP.md) is a separate, narrower document: a mechanical
utility-by-utility mapping table used while porting components into this
package, not part of the contract above. Consult it only when moving an
existing component's markup in; it is not required reading for authoring a
new component from scratch.

See also `.claude/skills/zudo-doc-design-system/SKILL.md` for the accent-budget
rules (≤2–3 accent elements per viewport, hover always neutral) that govern how
components spend the `accent` token at runtime.

### Component-scoped CSS (rare exception)

Almost every component styles itself entirely with Tailwind utility classes —
no component-owned CSS file, on top of the two required imports above, is
normally needed. `ProseMd` (#373) is the first exception: it mounts an opaque,
runtime-rendered HTML fragment (arbitrary markdown → `<h2>/<p>/<ul>/...`) that
no `Prose*` per-element override can reach, so it ships its own scoped
stylesheet, co-located at `@zudo-sg/ui/src/content/prose-md/prose-md.css`
(exposed via the package's `./src/*` export, like any other source file).

**A consumer that renders `ProseMd` must import that file too**, in addition
to `tokens.css` + `colors.css` above — omitting it does not break anything,
it just leaves `ProseMd` rendering unstyled native HTML (the two required
imports alone are not sufficient for this one component). This repo's root
app wires it into its single bundled stylesheet via
`src/styles/global.css`'s `@import "@zudo-sg/ui/src/content/prose-md/prose-md.css"`
— see that import's comment for why, and `prose-md.css`'s own header for what
it does and does not style. A future consumer outside this repo (e.g. a
sibling workspace's own CSS graph) needs the equivalent import wired in
manually; it is not part of the two-import baseline contract.

---

## 2. File location & discovery mechanism

**Category-nested is now the only layout in use in this repo**:
`src/<category-slug>/<component>/<name>.stories.tsx` — e.g.
`src/cards/card/card.stories.tsx`. `<category-slug>` is the lowercase,
hyphenated form of the component's `StoryCategory` (see §3), e.g.
`"Data Display"` → `data-display`. A component's own directory name must
still equal its story stem (`card/card.stories.tsx`, not
`card/story.stories.tsx`) — one dir per component, same rule as the
original layout below, just with one more directory level in front of it.

The scaffolder and the discovery codegen (below) still also support the
**original one-level layout** — `src/<component>/<name>.stories.tsx` — for
forks that prefer a flat convention; every component this repo ships now uses
the nested form (the flat components that predated it were retired in the
port to the new component set). `pnpm new:component` defaults to flat and
only produces the nested layout when passed `--nested` (§8).

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

### The barrel: organized by `StoryCategory`, not by directory

`packages/ui/src/index.ts` (the barrel) exports the full current component
set, grouped into one `// ── <Category> ──` section per `StoryCategory` (§3)
— not by the on-disk category-nested directory (a directory can span several
`StoryCategory` values; see §"The `StoryCategory` set" note in the root repo's
`ADOPTING.md`). This shape replaced an earlier one-level-layout barrel whose
export names came straight from the original flat components; it was rebuilt
from scratch once the new component set fully replaced the old one, so there
was never a need to resolve name collisions incrementally.

**Settled policy: `pnpm new:component --nested` (§8) auto-inserts into the
barrel, same as a flat scaffold.** A category-nested scaffold is fully
catalog-visible and testable the moment it's created regardless — the
registry (`sg-registry.ts` / `story-modules.ts`) imports every story via its
package subpath (`@zudo-sg/ui/src/<category>/<name>/<name>.stories.tsx`),
**never** via the barrel — but by default it's *also* reachable from
`@zudo-sg/ui`'s top-level import the moment it's scaffolded: the scaffolder
inserts its `export { … }` / `export type { … }` pair alphabetically into the
matching `// ── <Category> ──` section (see `index.ts`'s own header comment),
importing from the nested path `./<category-slug>/<name>/<name>`. Pass
`--skip-barrel` to opt out and add the export by hand later (e.g. to place it
in a non-default position). Because two different categories may scaffold a
same-named component (above) but the barrel can't hold two exports of the
same Pascal name, the scaffolder fails with an actionable error instead of
writing a colliding export when that happens — alias one of the two
manually.

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
a one-liner. Most stories in this package follow this (see
`cta-button.stories.tsx` → `Playground`).

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
  (e.g. `SiteHeader`), wrap it in a `render`-local container that neutralizes
  the effect for the catalog cell (a bounded-height `position: relative` box
  with `overflow: hidden` contains a `sticky`/`fixed` child without needing a
  prop on the component itself) — `site-header.stories.tsx` does this.

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
# One-level (legacy layout — no component in this repo uses it anymore;
# retained for forks that prefer a flat convention):
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
  `"Data Display"` → `data-display`). A nested scaffold auto-inserts into the
  barrel (`packages/ui/src/index.ts`) exactly like a flat scaffold, importing
  from the nested path `./<category-slug>/<name>/<name>` — see "The barrel:
  organized by `StoryCategory`, not by directory" in §2. Scaffolding a name
  that's already exported from the barrel under a different category fails
  with an actionable error instead of writing a colliding export.
- `--skip-barrel` skips the barrel-export insert step (below) — use it when
  you want to add the export by hand, e.g. to place it in a non-default
  position, or to work around a duplicate-name collision by aliasing it
  yourself. Works the same for flat and `--nested` scaffolds.

It creates, following the existing house pattern (variant union + `Record`
class map + `class?` passthrough + the shared focus-visible outline classes):

- `packages/ui/src/<name>/<name>.tsx` (or, nested,
  `packages/ui/src/<category-slug>/<name>/<name>.tsx`) — typed-props component
  skeleton.
- …`/<name>.stories.tsx` — `StoryMeta` + a typed `Story<Props>` `Playground`
  variant with a controls skeleton (§3/§4).
- …`/__tests__/<name>.test.tsx` — a starter test suite.
- The barrel export in `packages/ui/src/index.ts`, inserted alphabetically
  into the matching `// ── <Category> ──` section — for both flat and
  `--nested` scaffolds, unless `--skip-barrel` is passed or this project has
  no barrel-file convention (see below).
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
src/<component>/<component>.mdx      # one-level layout (see §2)
# category-nested layout (current convention — e.g. src/cards/card/card.mdx):
src/<category-slug>/<component>/<component>.mdx
```

- **Optional and co-located.** Same directory + base name as the component and
  its story (`card.tsx`, `card.stories.tsx`, `card.mdx`). A component with
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

## 10. Composer contract (optional opt-in)

The `/composer` sub-application (epic #243) lets an author build a page by
composing real components into a persisted, JSON-safe tree. A component becomes
available in the Composer **only** by explicitly opting in — there is no
automatic exposure, and `Story.render()` is never part of the Composer renderer
contract (the Composer instantiates the real component, not a showcase variant).

Opt in by setting the OPTIONAL `composer` property on `meta`, authored with the
`defineComposer<P>(…)` identity helper (mirrors `defineStory<P>`). It typechecks
the definition against the component's real props, then erases to the
non-generic `ComposerMeta` that `StoryMeta.composer` stores. A separate named
`composer` export is **not** viable — §3's contract test treats every non-default
export as a `Story`.

```tsx
import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { CtaButton, type CtaButtonProps } from "./cta-button";

const meta: StoryMeta = {
  title: "CtaButton",
  category: "Actions",
  description: "…",
  usage: "…",
  composer: defineComposer<CtaButtonProps>({
    componentId: "ui.cta-button", // stable, opaque — see invariants below
    version: 1,
    component: CtaButton,
    source: {
      module: "@zudo-sg/ui/src/shared/cta-button/cta-button",
      exportKind: "named",
      exportName: "CtaButton",
    },
    defaults: { href: "/products", variant: "primary", children: "Browse" },
    fields: [
      { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
      { kind: "boolean", prop: "arrow", label: "Arrow" },
      { kind: "text", prop: "children", label: "Label", inlineEdit: {} },
    ],
    // slots: [{ id: "right", prop: "right", label: "Right", cardinality: "many" }],
    adapters: {
      // Trusted, non-serializable. Resolves the editable text node for
      // inline editing (CtaButton renders a trailing arrow, so a prop flag
      // alone can't target the label). Runtime-registry side only.
      inlineEditor: { field: "children", resolveElement: (root) => root },
    },
  }),
};

export default meta;

export const Playground: Story<CtaButtonProps> = { /* … */ };
```

### What a definition carries

- **`componentId`** + **`version`** — stable identity and schema version.
- **`component`** — the actual typed Preact component (trusted; runtime only).
- **`source`** — `{ module, exportKind: "named" | "default", exportName, localName? }`
  for deterministic JSX/import generation.
- **`defaults`** — JSON-safe initial prop values, keyed to real props.
- **`fields`** — typed scalar-prop descriptors (`text` / `select` / `boolean` /
  `number` / `color`). A `text` field may set
  `inlineEdit?: { multiline?, mode? }` — see "Inline-edit modes" below.
- **`slots`** — named structural slots: `{ id, prop, label, accepts?, cardinality }`.
  `id` is the **persisted document key**; `prop` is the real prop it fills.
- **`constraints?`** — optional JSON-safe structural constraints.
- **`adapters?`** — TRUSTED, non-serializable `render` / `source` / `inlineEditor`
  functions (runtime-registry side only; stripped from the serializable manifest).

Display `title` / `category` / `description` are **not** duplicated in the
definition — they stay sourced from the owning `StoryMeta`.

### Two projections, one definition

- **Runtime registry** (`src/styleguide/data/composer-registry.ts` →
  `composerEntries`) keeps `component` and `adapters` and drives the preview.
- **Serializable manifest** (`composerManifest`) strips every function so it
  crosses to the parent window / chooser / inspector as pure JSON. A strict zod
  schema (`composer-schema.ts`) rejects any leaked function.

The registry is DERIVED from the same generated `storyModules` map the catalog
already imports — it filters for opted-in metas, never a second filesystem scan
or `import.meta.glob`.

### Inline-edit modes

A `text` field's `inlineEdit` object carries an optional `mode`:

- `"plain"` (default, omitting `mode` means this) — the existing auto-commit
  inline session (wave-8 / #257, #288): edits commit as the user types/blurs.
- `"markdown-source"` — the canvas inline editor shows the raw markdown source
  as plain text and routes through the explicit-save session instead (no
  auto-commit anywhere) — see epic #368. This is a PARALLEL path keyed off the
  mode marker, not a modification of the `"plain"` session.

```tsx
fields: [
  { kind: "text", prop: "markdown", label: "Body", inlineEdit: { mode: "markdown-source" } },
],
```

### Invariants (enforced by the host validator + type system)

- `componentId` and slot `id`s must **not** derive from title, slug, category,
  or file path, and stay stable across renames/moves.
- Structural slots are opt-in only — `children` is never inferred as a slot from
  `ComponentChildren`; it can be a scalar `text` field or a container slot.
- One prop cannot be both a scalar field and a structural slot.
- `defaults` (and all field values) must be JSON-safe; functions/VNodes never
  enter the serializable manifest.
- At most one inline-editable field per component (MVP).
- A field declaring `inlineEdit` MUST have a matching `adapters.inlineEditor`
  whose `field` references that same prop (#372) — the host validator rejects
  an inlineEdit field with no adapter (or one that targets a different field)
  as an authoring-time error, rather than letting it silently never become
  editable (`inlineEditableForEntry()` would otherwise just return `null`).

Full authoring types live in
[`src/composer/types.ts`](./src/composer/types.ts) (re-exported from the package
root). The runtime derivation, validation, and manifest projection live host-side
in `src/styleguide/data/composer-registry.ts`.
