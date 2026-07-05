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
Strategy*) — the same shape as zudo-doc's raw `--zd-0..15` palette feeding its
semantic `--color-*` tokens:

| Tier | What | Where |
|---|---|---|
| **1 — Palette** | Raw oklch values, named `--palette-{family}-{step}` (families `cool`/`warm`/`brand`/`accent`/`success`/`danger`, numeric steps light→dark) | `styles/colors.css` (top `:root` block) |
| **2 — Semantic** | Roles → palette: every `--color-*` token is a `light-dark()` pair of `var(--palette-…)` refs | `styles/colors.css` (`@theme`) |
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

- **Co-locate** each story file with its component: `src/<component>/<name>.stories.tsx`.
- **Naming:** always `*.stories.tsx` (the `.stories` infix is the discovery key).
- **Discovery is codegen, not `import.meta.glob`.** zfb does not statically
  inline `import.meta.glob` — the literal call survives into the shared client
  islands bundle and throws in the browser (`import.meta.glob` is undefined
  there). So the catalog cannot use a runtime glob at all. Instead,
  [`scripts/gen-sg-registry.mjs`](../../scripts/gen-sg-registry.mjs) (repo
  root) globs `packages/ui/src/*/*.stories.tsx` **on the filesystem at codegen
  time** and regenerates two explicit-import lists from what it finds:

  - `src/styleguide/data/sg-registry.ts` (repo root) — the catalog's
    path→module registry.
  - the `GENERATED:SG_REGISTRY_BEGIN`…`END` block in
    [`src/stories/__tests__/story-modules.ts`](./src/stories/__tests__/story-modules.ts)
    — the shared `STORY_MODULES` registry imported by `contract.test.ts` and
    `source-drift.test.ts`.

  Both generated blocks are byte-identical in shape to what a real
  `import.meta.glob({ eager: true })` would have produced, just computed ahead
  of time instead of at runtime.

- **After adding, renaming, or removing a story file**, run
  `pnpm gen:sg-registry` from the repo root and commit the regenerated files.
  `pnpm check:sg-registry` (wired into CI and `scripts/run-b4push.sh`) fails
  the build if the generated blocks drift from what's on disk — forgetting to
  regenerate is a build failure, not a silently-missing catalog entry.
- **Never hand-edit** between the `GENERATED:SG_REGISTRY_BEGIN`/`END` markers
  in either generated file; the next `pnpm gen:sg-registry` run overwrites it.

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
`"Actions" | "Typography" | "Layout" | "Data Display" | "Forms" | "Navigation"`.
Adding a category means editing `StoryCategory` in `src/stories/types.ts` (so the
catalog and the authors share one list). The catalog should render categories in
the union's declared order.

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
- [ ] `pnpm check` (typecheck) and `pnpm test:unit` pass.
