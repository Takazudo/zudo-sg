# Story-authoring notes (`@zudo-sg/demo-ui`)

**The canonical, full story-authoring contract now lives at the
`@takazudo/zudo-sg` engine's doc site:**
**[Story Spec](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec)**
(source: `doc/src/content/docs/reference/story-spec.mdx`, generated from the
engine's actual contract — `packages/styleguide/src/stories/types.ts` and
`packages/styleguide/src/cli/registry/discover-stories.ts`). That page covers
module shape, `StoryMeta`/`Story<P>` fields, controls, source extraction, the
directory-depth discovery constraint, and browser/MSW rules for every host of
the engine, not only this package. Sections below that used to hold that
generic material now just point there; **this document keeps only what's
specific to `@zudo-sg/demo-ui`** — how it's consumed (no build step), its own
directory layout and barrel, its scaffolder defaults, and per-component MDX
docs.

The TypeScript shapes referenced here live in
[`src/stories/types.ts`](./src/stories/types.ts) — a re-export of the
engine's canonical `@takazudo/zudo-sg/stories` types. Keep this doc and that
file in sync.

---

## 1. How the package is consumed: **from source**

`@zudo-sg/demo-ui` has **no build step**. Its `package.json` points `main` and the
`"."` export at `src/index.ts` directly:

```jsonc
"main": "./src/index.ts",
"exports": {
  ".": "./src/index.ts",
  "./styles/tokens.css": "./styles/tokens.css",
  "./styles/colors.css": "./styles/colors.css",
  "./styles/components.css": "./styles/components.css",
  "./styles/wind-tokens.mjs": "./styles/wind-tokens.mjs"
}
```

Consumers (the root styleguide host and `apps/demo`) import the `.tsx`/`.ts`
source and let **their own** Vite/zfb pipeline transpile it. There is nothing to
compile or publish before consuming. Two consequences for the catalog:

1. The catalog imports components and stories as source — no `dist/` lookup.
2. The host's wind compiler must scan this package's source. In zfb config,
   use `wind.sources.packageRoots: ["@zudo-sg/demo-ui"]` for the workspace
   package and retain the host's own source roots. Import the semantic token
   map and breakpoints from `@zudo-sg/demo-ui/styles/wind-tokens.mjs`.
   Use strict mode, `dark: false`, `reset: "owned-v1"`, and
   `utilities: { placement: "before-authored" }`.

### Required style imports

Components reference **semantic token utilities only** (`bg-accent`, `text-fg`,
`border-border`, `bg-surface-2`, `shadow-card`, `gap-vsp-md`, …). Those
utilities use the wind token map; the consumer also imports all three shared
stylesheets, in this order:

```css
@layer zw-reset;
@import "@zudo-sg/demo-ui/styles/tokens.css";   /* spacing, type, radius, shadow */
@import "@zudo-sg/demo-ui/styles/colors.css";   /* semantic colors, light + dark  */
@import "@zudo-sg/demo-ui/styles/components.css"; /* authored category rules */
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
| **2 — Semantic** | Roles → palette: `--color-*` tokens backed by palette refs, with a few AA-tuned light-mode literals | `styles/colors.css` (plain `:root`) + `styles/wind-tokens.mjs` |
| **3 — Component** | Scoped semantic overrides and unsupported utility replacements | category CSS aggregated by `styles/components.css` |

Components bind only to semantic utilities (`bg-accent`, `text-fg`,
`border-border`, …). Palette variables remain private implementation values:
the wind map exposes semantic roles, so palette utilities are not generated.
Both palette and semantic variables live in `colors.css`, preserving the single
color-sheet import. Brand changes update that file without component edits.

[`TOKEN-MAP.md`](./TOKEN-MAP.md) is a separate, narrower document: a mechanical
utility-by-utility mapping table used while porting components into this
package, not part of the contract above. Consult it only when moving an
existing component's markup in; it is not required reading for authoring a
new component from scratch.

See also `.claude/skills/zudo-doc-design-system/SKILL.md` for the accent-budget
rules (≤2–3 accent elements per viewport, hover always neutral) that govern how
components spend the `accent` token at runtime.

### Component CSS and wind candidates

Use complete literal wind candidates; dynamically concatenated candidates are
not extracted. Preserve supported variants, including `md:` (768px), `xl:`
(1280px), and `max-sm:` (below 640px). Check uncertain candidates with
`pnpm exec zfb wind explain <candidate>`.

Unsupported forms become unlayered `zc-*` rules in `src/<category>/<category>.css`,
aggregated by `styles/components.css`. They must not start with a utility root
or be hidden with `authoredClasses`. At equal specificity, unlayered rules emitted after
wind's unlayered utilities retain precedence. `ProseMd` additionally
requires `@zudo-sg/demo-ui/src/content/prose-md/prose-md.css` for its opaque
markdown fragment; import it in the host stylesheet too.

---

## 2. File location & discovery mechanism

**Category-nested is now the only layout in use in this repo**:
`src/<category-slug>/<component>/<name>.stories.tsx` — e.g.
`src/cards/card/card.stories.tsx`. `<category-slug>` is the lowercase,
hyphenated form of the component's `category` (see §3), e.g.
`"Data Display"` → `data-display`. A component's own directory name must
still equal its story stem (`card/card.stories.tsx`, not
`card/story.stories.tsx`) — one dir per component, same rule as the
original layout below, just with one more directory level in front of it.

The engine's discovery mechanism also supports the **original one-level
layout** — `src/<component>/<name>.stories.tsx` — for hosts that prefer a
flat convention; every component this repo ships now uses the nested form
(the flat components that predated it were retired in the port to the new
component set). `pnpm new:component` defaults to flat and only produces the
nested layout when passed `--nested` (§8).

Two different categories MAY scaffold a same-named component (e.g.
`layout/badge/` and `forms/badge/`) — the catalog keys everything off the full
directory path, never the bare component name, so this produces two distinct,
independently-addressable catalog entries rather than a collision. The
identifier-derivation rule that makes this work, and the directory-depth
constraint every story file must satisfy (a flat file with zero directories
between it and the components root collides), are documented once, at the
engine's own [Story Spec → File location & discovery](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec#file-location-discovery)
— this package just follows it.

- **Naming:** always `*.stories.tsx` (the `.stories` infix is the discovery key).
- **Discovery is codegen, not `import.meta.glob`.** zfb does not statically
  inline `import.meta.glob`, so the catalog cannot use a runtime glob. The
  `zudo-sg` CLI's `gen-registry` command globs `packages/demo-ui/src/**/*.stories.tsx`
  (any depth — both layouts above) on the filesystem at codegen time and
  writes an explicit-import registry to `src/styleguide/sg-registry.ts` (repo
  root; this repo's `zudo-sg.config.mjs` `registryOut`), plus the
  `GENERATED:SG_REGISTRY_BEGIN`…`END` block in
  [`src/stories/__tests__/story-modules.ts`](./src/stories/__tests__/story-modules.ts)
  — the shared `STORY_MODULES` registry imported by `contract.test.ts` and
  `source-drift.test.ts`.
- **After adding, renaming, or removing a story file**, run
  `pnpm gen:sg-registry` from the repo root and commit the regenerated files.
  `pnpm check:sg-registry` (wired into CI and `scripts/run-b4push.sh`) fails
  the build if the generated blocks drift from what's on disk.
- **Never hand-edit** between the `GENERATED:SG_REGISTRY_BEGIN`/`END` markers
  in either generated file; the next `pnpm gen:sg-registry` run overwrites it.

### The barrel: organized by category, not by directory

`packages/demo-ui/src/index.ts` (the barrel) exports the full current component
set, grouped into one `// ── <Category> ──` section per declared category
(`src/stories/categories.ts`'s `STORY_CATEGORIES`) — not by the on-disk
category-nested directory (a directory can span several categories). This
shape replaced an earlier one-level-layout barrel whose export names came
straight from the original flat components; it was rebuilt from scratch once
the new component set fully replaced the old one, so there was never a need
to resolve name collisions incrementally.

**Settled policy: `pnpm new:component --nested` (§8) auto-inserts into the
barrel, same as a flat scaffold.** A category-nested scaffold is fully
catalog-visible and testable the moment it's created regardless — the
registry (`sg-registry.ts` / `story-modules.ts`) imports every story via its
package subpath (`@zudo-sg/demo-ui/src/<category>/<name>/<name>.stories.tsx`),
**never** via the barrel — but by default it's *also* reachable from
`@zudo-sg/demo-ui`'s top-level import the moment it's scaffolded: the scaffolder
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

Every `*.stories.tsx` exports **exactly** a default `meta: StoryMeta` and one
or more named `Story<P>` exports. Full field-by-field tables for both types —
including that `category` is now an **open string** (any value is valid; a
host's `categoryOrder` decides display order, unlisted categories append
alphabetically) — are in the
[Story Spec → Module shape](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec#module-shape).

This package's own declared category order lives in
[`src/stories/categories.ts`](./src/stories/categories.ts)'s
`STORY_CATEGORIES`; `zudo-sg new-component --category <Category>` accepts any
string and warns (doesn't fail) when it isn't one of the declared ones.

## 4. Controls convention (optional, metadata-only)

`controls` **describes** the knobs a variant could expose; it does not wire
them up — see the
[Story Spec → Controls convention](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec#controls-convention-optional-metadata-only)
for the full `StoryControl<P>` shape and typing rules.

## 5. Source extraction

The catalog shows a code panel per variant, preferring an explicit `source`
over `meta.usage` — see the
[Story Spec → Source extraction](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec#source-extraction).

**Authoring guidance for this package:** set `source` on any variant whose
rendered markup is not a one-liner. Most stories in this package follow this
(see `cta-button.stories.tsx` → `Playground`).

## 6. Browser-only / MSW / data rules

The catalog renders stories during a **static build** (zfb): `render` must be
pure, synchronous, and self-contained (no browser activation work, no top-level `await`,
no network calls, no MSW, no reliance on ambient page chrome) — see the
[Story Spec → Browser-only / MSW rules](https://zudo-sg-doc.takazudomodular.com/docs/reference/story-spec#browser-only-msw-rules)
for the full rules and the `previewRoute` escape hatch (a real page route for
components that can only be honestly demoed with live/mocked network data;
MSW is permitted only inside that page, never in a `*.stories.tsx` file or any
component source under `packages/demo-ui/src`).

This package's `previewRoute` demo pages live under `pages/preview/*.tsx` at
the repo root (e.g. `pages/preview/contact.tsx`); the catalog's own variant
iframe is served at `/components/preview`
(`packages/styleguide/src/preview/route.ts`).

## 7. Authoring checklist

When adding a component, ship its story in the same change:

- [ ] `src/<category-slug>/<component>/<component>.stories.tsx` exists
      (co-located, category-nested — see §2).
- [ ] Default export is a `StoryMeta` with `title`, `category` (prefer
      `STORY_CATEGORIES`), `description`, `usage`.
- [ ] At least one named `Story<P>` export with `name` + pure synchronous
      `render`.
- [ ] `source` set on any non-trivial variant.
- [ ] `controls` added where live editing is meaningful (optional).
- [ ] Component uses only semantic token utilities (passes `pnpm lint:tokens`).
- [ ] _(Optional)_ a co-located `.mdx` docs file (§9) for guidelines / do-don't
      / a11y notes beyond `description` + `usage`.
- [ ] `pnpm check` (typecheck) and `pnpm test:unit` pass.

---
## 8. Scaffolding a new component

`pnpm new:component <name> --category <Category>` (repo root) generates the
whole checklist above in one command, in either directory layout from §2:

```
# One-level (legacy layout — no component in this repo uses it anymore;
# retained for forks that prefer a flat convention):
pnpm new:component demo-widget --category Layout

# Category-nested (current convention — packages/demo-ui/src/<category-slug>/<name>/):
pnpm new:component demo-widget --category Layout --nested
```

- `<name>` must be kebab-case.
  - Flat mode: must not already exist under `packages/demo-ui/src/`.
  - `--nested` mode: must not already exist under
    `packages/demo-ui/src/<category-slug>/` — the SAME name in a DIFFERENT
    category is fine (that's the point of category-nesting; see §2).
- `<Category>` is a free-form string (`StoryCategory` is open, §3); prefer
  one of zudo-sg's own declared categories: `Actions`, `Typography`,
  `Layout`, `Data Display`, `Forms`, `Navigation`, `Content`, `Landing`,
  `News`, `Search`, `Feedback`, `Media`. A new category is accepted with a
  warning and sorts alphabetically after these in the sidebar.
- `--nested` scaffolds into `packages/demo-ui/src/<category-slug>/<name>/` instead
  of the flat `packages/demo-ui/src/<name>/`, where `<category-slug>` is
  `<Category>` lowercased with spaces replaced by hyphens (e.g.
  `"Data Display"` → `data-display`). A nested scaffold auto-inserts into the
  barrel (`packages/demo-ui/src/index.ts`) exactly like a flat scaffold, importing
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

- `packages/demo-ui/src/<name>/<name>.tsx` (or, nested,
  `packages/demo-ui/src/<category-slug>/<name>/<name>.tsx`) — typed-props component
  skeleton.
- …`/<name>.stories.tsx` — `StoryMeta` + a typed `Story<Props>` `Playground`
  variant with a controls skeleton (§3/§4).
- …`/__tests__/<name>.test.tsx` — a starter test suite.
- The barrel export in `packages/demo-ui/src/index.ts`, inserted alphabetically
  into the matching `// ── <Category> ──` section — for both flat and
  `--nested` scaffolds, unless `--skip-barrel` is passed or this project has
  no barrel-file convention (see below).
- A `gen:sg-registry` run, so the component is registered in the catalog
  immediately (§2) — no separate step needed, for either layout.

The generated files typecheck, pass `lint:tokens`, and pass the story-authoring
contract test as-is (the two placeholder `variant`s exist so nothing is
half-typed). Fill in the `TODO`s — the real markup, variant classes, and
description — then run `pnpm check` and `pnpm test:unit` before shipping.

`pnpm new:component` wraps the `zudo-sg` CLI's `new-component` command (name/
category validation, the category→slug mapping, templates, and the
barrel-insertion algorithm all live in `@takazudo/zudo-sg`'s
`src/cli/scaffold/*`, unit-tested there) — see the
[CLI reference](https://zudo-sg-doc.takazudomodular.com/docs/reference/cli)
for the full flag contract.

### This package's scaffolder configuration

The CLI reads this repo's root `zudo-sg.config.mjs`, not a per-package config
file. The fields that shape `new-component`'s output for this package:

- `componentsRoots[0].dir` = `"packages/demo-ui/src"` — the directory scanned/
  written to for `<name>/<name>.{tsx,stories.tsx}`.
- `barrelIndex` = `"packages/demo-ui/src/index.ts"` — the barrel file
  `new-component` inserts an `export { … }` block into. `null` skips the
  insert step for a project with no barrel-file convention (same as always
  passing `--skip-barrel`).
- `uiPackageName` = `"@zudo-sg/demo-ui"` — used in generated `usage` snippets and
  the package-scoped import specifiers the registry codegen emits.

See [zudo-sg.config.mjs reference](https://zudo-sg-doc.takazudomodular.com/docs/reference/zudo-sg-config)
for every field.

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
  `packages/demo-ui/src` (`include: ["**/*.mdx"]` — the globset `**` matches zero
  or more directory components, so one pattern covers both the flat and
  category-nested layouts), so zfb's Rust pipeline compiles it at build time.
  The engine detail route (`packages/styleguide/src/routes/components-slug.tsx`) looks up the entry by
  deriving its slug from the story path
  ([`packages/styleguide/src/registry/component-docs.ts`](../styleguide/src/registry/component-docs.ts))
  and renders `<entry.Content>` inside a `.zd-content` wrapper. Discovery is
  therefore keyed off the **same** `packages/demo-ui/src/` root the `gen-sg-registry`
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

## 10. No provider layer

This package ships components and stories only — there is no Composer
sidecar, generated component pack, or provider CSS entry. `@zudo-sg/demo-ui`
is this repo's own demo/showcase library, not something installed by the
engine or consumed by another product; the standalone
[zudo-composer](https://github.com/Takazudo/zudo-composer) repository has no
coupling to this package. Authoring a new component stops at the checklist in
§7 (component + story, optionally an MDX doc per §9) — there is no further
sidecar or handoff step.

Components use zudo-react `Child`/`Component` types, `class`, CSS-spelled style
keys, and native `on:*` events. Setup runs once: state belongs in signals;
browser listeners and observers belong in `scope.onActivate` with cleanup.
A `"use client"` module exports only island components and erased types.
`ThemeControl` keeps that unique function name as its scanner marker; a host
wrapper stays server-only and imports it statically. Island props must be
serializable: `onThemeChange` callbacks are available inside a client scope,
not as server boundary props.

### Field accessibility contract

`Field.children` is a render prop receiving `{ id, describedBy }`. Forward both
to the control; a hint yields `${id}-hint`, and no hint yields undefined.

```tsx
<Field id="email" label="Email" hint="Use your work address">
  {({ id, describedBy }) => (
    <Input id={id} aria-describedby={describedBy} type="email" />
  )}
</Field>
```

### Package test helpers

Use `src/test-utils/zudo-react.ts`: `renderSsr(node, context?)` returns HTML;
`renderIsland(Component, props, options?)` hydrates by default (or uses
`mode: "mount"`) and returns `{ container, html, diagnostics, flush, dispose }`.
Queries (`getByText`, `getByRole`, `queryByText`, `queryAllByRole`) take an explicit
root. Native heading levels and other unsupported query details use DOM selectors.
Dispatch with `fire(element, "click")`, then await `flushAll()` or the fixture's
`flush()`. Use bounded `vi.waitFor` for arbitrary imports. Hydration diagnostics
fail activation, flush, and disposal; `allowDiagnostics` is for negative tests.
Register `afterEach(disposeAll)`; new props require disposing and remounting.
Enhancer fixtures contain both SSR markup and their enhancer. Assert individual
classes with `classList.contains`; U6 owns source-drift snapshot updates.
