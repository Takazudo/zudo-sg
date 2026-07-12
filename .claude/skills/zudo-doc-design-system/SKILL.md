---
name: zudo-doc-design-system
description: "Project-specific CSS and component rules for zudo-doc. Must be consulted before writing or editing CSS, Tailwind classes, color tokens, or component markup in this project. Covers: component-first strategy, design token system, three-tier color architecture, and palette index convention. Triggered by 'design system', 'zudo-doc-design-system', 'zudo-doc-css-wisdom' (old name)."
user-invocable: true
argument-hint: "[topic: tokens, colors, component-first, palette]"
---

# zudo-doc CSS & Component Rules

**IMPORTANT**: These rules are mandatory for all code changes in this project that touch CSS, Tailwind classes, color tokens, or component markup. Read the relevant section before making changes.

## How to Use

This project has **two parallel token worlds** — read the one relevant to the file you're
touching (see "Two Worlds" below for which is which):

| Topic | File |
|-------|------|
| Doc-chrome tokens (root host: `--zd-*` palette, `text-fg`/`bg-surface`/etc.), Tailwind `@theme` | `src/styles/global.css` |
| Shared spacing (`hsp-*`/`vsp-*`) + typography (Tier 1/2 `--text-*`) tokens | `packages/ui/styles/tokens.css` |
| `@zudo-sg/ui` semantic colors (ink/paper/surface/line/brand/state), three-tier color system, consumption model | `packages/ui/styles/colors.css`, `packages/ui/STORIES.md` (§1 "How the package is consumed", §"Three-tier color system") |
| Component-first / server-rendered-by-default methodology | root `CLAUDE.md` ("Components" section) |

Read ONLY the file(s) relevant to your task. Apply their rules strictly. (There is no
`src/content/docs/reference/` directory in this repo — those files don't exist; the rules
below plus the source files above are the source of truth.)

## Quick Rules (always apply)

### Component First (no custom CSS classes)

- **NEVER** create CSS module files, custom class names, or separate stylesheets
- **ALWAYS** use Tailwind utility classes directly in component markup
- The component itself is the abstraction — `.card`, `.btn-primary` are forbidden
- Use props for variants, not CSS modifiers

### Design Tokens (no arbitrary values)

- **NEVER** use Tailwind default colors (`bg-gray-500`, `text-blue-600`) — they are reset to `initial`
- **NEVER** use arbitrary values (`text-[0.875rem]`, `p-[1.2rem]`) when a token exists
- **NEVER** use hardcoded hex values in components
- Spacing (shared everywhere — root, `packages/ui`, `apps/demo`): `hsp-*` (horizontal),
  `vsp-*` (vertical), 7-8 steps `2xs`/`3xs`→`2xl`. Defined once in `packages/ui/styles/tokens.css`.
- Typography (shared, same file): Tier 1 abstract sizes `text-xs`…`text-2xl` (each with a paired
  line-height), plus Tier 2 semantic aliases `text-micro`/`caption`/`small`/`body`/`heading`/`display`
  (each a `var()` onto a Tier-1 rung). Which tier to use depends on which world you're in — see below.

### Two Worlds: doc-chrome vs. `@zudo-sg/ui` components

This monorepo has two independent semantic **color** layers sharing the one spacing/typography
token file above. Know which world the file you're editing belongs to:

- **Doc-chrome world** (root-only: `src/**`, `pages/**` — the styleguide host's own header,
  sidebar, search, doc prose, panels): colors come from `src/styles/global.css`'s `--zd-*` →
  `--color-*` mapping. Utilities: `text-fg`, `bg-surface`, `border-muted`, `text-accent`, plus the
  raw `p0`–`p15` palette. Doc prose (`.zd-content`) consumes the Tier-2 typography aliases
  (`text-body`, `text-caption`, ...) via `@takazudo/zudo-doc`'s `content.css`.
- **UI-component world** (`packages/ui/src/**`, also consumed by `apps/demo` and by the root's
  `/components/*` catalog): colors come from `packages/ui/styles/colors.css`'s semantic tokens —
  `bg`, `surface`/`surface-2`, `border`, `fg`/`muted`, `accent`/`accent-hover`, `on-accent`,
  `focus`, `success`/`danger`/`warning`/`info`, `loading-scrim`, and the persistent-dark-nav
  `rail-*` family (`rail-bg`, `rail-bg-strong`, `rail-fg`, `rail-muted`, `rail-border`,
  `rail-hover-bg` — intentionally NOT a `light-dark()` pair; it stays dark in both schemes).
  All ~70 components use the **Tier-2 semantic** typography aliases directly (`text-body`,
  `text-title`, `text-caption`, ...) — this is the inverse of the doc-chrome convention, and the
  inverse of what this section used to say before the port: there is no longer any component
  in this package using the Tier-1 abstract sizes (`text-sm`, `text-lg`, ...) directly. See
  `packages/ui/styles/tokens.css`'s header comment for the two-tier rationale.
- Ten token **names** exist in both worlds (`bg`, `fg`, `surface`, `muted`, `accent`,
  `accent-hover`, `success`, `danger`, `warning`, `info` — widened from an original four when
  the UI palette adopted these names). On root-host pages the doc-chrome `@theme` block in
  `global.css` re-asserts all ten to the `--zd-*` values (source order wins), so a root-rendered
  `@zudo-sg/ui` component still matches the docs palette. In `apps/demo` (no re-assertion), the
  same ten names resolve to `@zudo-sg/ui`'s own values. The remaining UI-only names
  (`surface-2`, `border`, `focus`, `on-accent`, `loading-scrim`, the `rail-*` family) are NOT
  re-asserted — doc-chrome consumes none of them. Never assume a color utility means the same
  thing in both worlds — check which file you're in.
- The chrome-free `/components/preview` iframe document (`<html data-sg-preview-doc>`) has no
  `--zd-*` injected, so it needs its own entrypoint to restore the `@zudo-sg/ui` semantic colors
  that the root-host re-assertion above would otherwise leave undefined: `src/styles/preview.css`,
  imported after `global.css`'s `@zudo-sg/ui/styles/colors.css` import and scoped to
  `html[data-sg-preview-doc]` (specificity beats the `:root` the `@theme` block emits, so it's
  order-independent and never affects regular doc-chrome pages).

### Color Tokens (three-tier system)

Both worlds follow the same three-tier shape (palette → semantic → component), just with
different concrete tokens:

- **Doc-chrome** (`src/styles/global.css`):
  - **Tier 1** (palette): `p0`–`p15` — raw colors, use only when no semantic token fits
  - **Tier 2** (semantic): `text-fg`, `bg-surface`, `border-muted`, `text-accent` — prefer these
  - Palette index convention (consistent across all schemes, see `src/config/color-schemes.ts`):
    - p1=danger, p2=success, p3=warning, p4=info, p5=accent
    - p8=muted, p9=background, p10=surface, p11=text primary
- **UI-component** (`packages/ui/styles/colors.css`):
  - **Tier 1** (`--palette-{group}-{n}`): raw oklch values, GROUPED by role family —
    `base` (warm-neutral grayscale ramp), `accent` (amber action ramp), `state`
    (danger/success/warning/info), and a `line-*` ramp per business line. Plain
    `:root` vars (not `@theme`, so no `bg-palette-*` utility is ever generated) —
    **never** referenced by components directly
  - **Tier 2** (`--color-*`): semantic roles, each a `light-dark()` pair of Tier-1 refs — this is
    what components bind to (`bg-accent`, `text-fg`, ...)
  - Full contract + rationale: `packages/ui/STORIES.md` §"Three-tier color system"

### Search & highlight tokens (role-split)

Highlight roles are deliberately split across dedicated semantic tokens — do **not** share one token across unrelated highlight UIs.

- `matched-keyword-bg` / `matched-keyword-fg` — background and foreground of the search panel `<mark>` element. Driven by `--color-matched-keyword-bg` / `--color-matched-keyword-fg`; live-editable in the Design Token Panel. This is the single source of truth for "why is this color yellow in the search results" — the panel swatch matches the rendered highlight 1:1.
- `warning` — drives admonitions (`:::warning`), find-in-page (`.find-match`, `.find-match-active`), and any UI that is semantically a warning. Do **not** reuse it for new UI-chrome highlights.

**Rule**: when a new highlight role appears (new kind of mark, new pill, new callout), add a dedicated semantic token rather than bolting it onto `--color-warning` or another existing token. Each visible highlight color should map to exactly one panel swatch.

### Hover-state underline for link-like elements

Any element that navigates (rendered as `<a href>` or behaves as a link) MUST have `hover:underline focus-visible:underline`. Keyboard users need the same affordance as mouse users — never add `hover:underline` without the `focus-visible:underline` pair.

- **Links (do underline)**: doc content links, sidebar items, header main-nav, header overflow menu items, color-tweak panel unselected tabs, search result rows, footer links, doc history entries, breadcrumb trails, mobile TOC entries.
- **Controls (do NOT underline)**: buttons, toggles, sidebar resizer, palette selectors, color swatches, close icons. These use border/bg hover instead.

Precedents to copy the pattern from: `pages/lib/_search-widget-script.ts` (search result rows use `group-hover:underline group-focus-visible:underline`).

See also: `/css-wisdom` for light-mode / dark-mode contrast rules and the broader three-tier token strategy.

### Server-rendered Preact vs client islands

- Default to **server-rendered Preact `.tsx`** — emits zero JS. See root `CLAUDE.md`'s
  "Components" section for the canonical rule.
- Promote to a **client island** only when interactivity is needed: mark the module
  `"use client"` and mount it via zfb's `<Island>` wrapper (see `pages/lib/_body-end-islands.tsx`)
- Both follow the same utility-class approach
