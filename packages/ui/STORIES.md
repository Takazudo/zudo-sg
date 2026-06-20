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

---

## 2. File location & discovery glob

- **Co-locate** each story file with its component: `src/<component>/<name>.stories.tsx`.
- **Naming:** always `*.stories.tsx` (the `.stories` infix is the discovery key).
- **Discovery glob (registry lives at the repo root):**

  ```ts
  const modules = import.meta.glob("./packages/ui/**/*.stories.tsx", { eager: true });
  ```

  > **Why the repo root, not inside `packages/ui`?** zfb supports eager
  > `import.meta.glob` but **forbids `../` parent-relative glob patterns**. A
  > registry that lived inside `packages/ui` would need `../` to escape, which is
  > rejected. So the registry module must live at the **repo root** and use the
  > root-relative `./packages/ui/**/*.stories.tsx` pattern. Co-locating the
  > story files (rule above) is what makes this single glob find them all.

- `{ eager: true }` is required: the catalog reads `meta` + every named export at
  registration time (no lazy/dynamic import dance).

Current story files (one per component group):

```
src/button/button.stories.tsx
src/link/link.stories.tsx
src/heading/heading.stories.tsx
src/badge/badge.stories.tsx
src/card/card.stories.tsx
src/stat/stat.stories.tsx
src/site-header/site-header.stories.tsx
src/hero/hero.stories.tsx
src/footer/footer.stories.tsx
src/form/form.stories.tsx
```

---

## 3. Module shape

Every `*.stories.tsx` exports **exactly**:

- a **default export** `meta: StoryMeta`, and
- **one or more named exports**, each a `Story`.

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

### Named exports — `Story`

```ts
export const Variants: Story = {
  name: "Variants",                 // variant label shown above the preview
  render: () => (<div>…</div>),      // pure, synchronous; returns the preview node
  controls: [                       // optional; metadata only (see §4)
    { type: "select", prop: "variant", label: "Variant",
      options: ["primary", "secondary", "ghost"], defaultValue: "primary" },
  ],
  source: `<Button>Primary</Button>`, // optional; verbatim code panel (see §5)
};
```

| field      | type             | required | meaning |
|------------|------------------|----------|---------|
| `name`     | `string`         | yes      | Variant label. Unique within the file. |
| `render`   | `() => VNode`    | yes      | **Pure, synchronous.** Returns the preview node. No effects, no async, no data fetching. |
| `controls` | `StoryControl[]` | no       | Declarative knob descriptors. Metadata only — see §4. |
| `source`   | `string`         | no       | Verbatim JSX for the code panel — see §5. |

The optional `defineStory(story)` identity helper (exported from the package)
just pins the type for editor autocomplete; a plain object literal that
satisfies `Story` is equally valid.

---

## 4. Controls convention (optional, metadata-only)

`controls` **describes** the knobs a variant could expose; it does **not** wire
them. The catalog decides whether and how to render live controls. A story with
no `controls` renders fine — it's a static preview. This keeps story authoring
trivial and pushes interactivity entirely into the catalog (S6's call).

`StoryControl` is a discriminated union on `type`:

```ts
{ type: "select",  prop: "variant", label: "Variant", options: ["primary","ghost"], defaultValue: "primary" }
{ type: "boolean", prop: "block",   label: "Full width", defaultValue: false }
{ type: "text",    prop: "label",   label: "Label", defaultValue: "Click me" }
```

- `prop` names the component prop the control is intended to drive.
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
- [ ] At least one named `Story` export with `name` + pure synchronous `render`.
- [ ] `source` set on any non-trivial variant.
- [ ] `controls` added where live editing is meaningful (optional).
- [ ] Component uses only semantic token utilities (passes `pnpm lint:tokens`).
- [ ] `pnpm check` (typecheck) and `pnpm test:unit` pass.
