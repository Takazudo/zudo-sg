---
name: zudo-doc-design-system
description: "Project-specific CSS and component rules for the zudo-sg styleguide: accent budget (≤2-3 accent elements per viewport, hover neutral by default), border ladder, 14px functional-text floor, component-first strategy, design tokens, three-tier color architecture, and palette index convention. Must be consulted before writing or editing CSS, zudo-wind utilities, color tokens, or component markup in this project. Triggered by 'design system', 'zudo-doc-design-system', 'zudo-doc-css-wisdom' (old name), 'accent budget'."
user-invocable: true
argument-hint: "[topic: tokens, colors, component-first, palette, accent-budget]"
---

# zudo-doc CSS & Component Rules

**IMPORTANT**: These rules are mandatory for all code changes in this project that touch CSS, zudo-wind utilities, color tokens, or component markup. Read the relevant section before making changes.

## Non-Negotiables (read first)

- **Accent budget**: ≤2–3 accent elements per viewport at rest; most viewports 0–1. Max ONE filled-accent element per viewport.
- **Hover is neutral by default** (fg color-mix / brightness) — do not spend accent merely to indicate pointer hover.
- **Interactive chrome** (handles, resizers, guides) is muted/neutral at rest; reserve accent for the closed role whitelist below.
- **Borders come from the border ladder** (`--color-border` / `--color-border-strong`) — NEVER `--color-muted`, which is a text token, not a border token.
- **Functional text ≥ `--text-caption` (14px)**. `--text-micro` (12px) is for true meta only (counts, timestamps) — never uppercase + letter-tracked at 12px.
- **Accent role whitelist (closed)**: focus ring, selection outline, pressed/selected small controls (`aria-pressed`/`aria-current`), one primary CTA. Everything not listed is neutral by default.

Named failure mode: **the vivid-amber accent funnel** — selection, focus, hover, chips, and structural chrome all painted the same orange. When in doubt: neutral, bordered, 14px.

## How to Use

This project has **two parallel token worlds** — read the one relevant to the file you're
touching (see "Two Worlds" below for which is which):

| Topic | File |
|-------|------|
| Doc-chrome tokens (root host: `--zd-*` palette, semantic utilities, border ladder) | `src/styles/global.css`, `zfb.config.ts` |
| Shared spacing (`hsp-*`/`vsp-*`) + typography (Tier 1/2 `--text-*`) tokens | `packages/demo-ui/styles/tokens.css` |
| `@zudo-sg/demo-ui` semantic colors (ink/paper/surface/line/brand/state), three-tier color system, consumption model | `packages/demo-ui/styles/colors.css`, `packages/demo-ui/STORIES.md` (§1 "How the package is consumed", §"Three-tier color system") |
| Component-first / server-rendered-by-default methodology | root `CLAUDE.md` ("Components" section) |

Read ONLY the file(s) relevant to your task. Apply their rules strictly. (There is no
`src/content/docs/reference/` directory in this repo — those files don't exist; the rules
below plus the source files above are the source of truth.)

## CSS pipeline

- zfb 4 composes the zudo-wind configuration from zudo-doc, the host's top-level
  `wind` settings, and the engine's tokens. The root host's token mapping lives
  in `zfb.config.ts`; CSS files provide the corresponding `:root` values.
- `src/styles/global.css` declares `@layer zw-reset, zd-flow` and imports the
  shared component tokens/styles, zudo-doc content styles, the dashboard styles,
  and the engine stylesheet in the documented order.
- `withZudoSg()` registers the engine's public `wind.json` manifest. Configure
  host scans with `wind.sources`; use the independent `previewStyles` entry for
  preview documents, compiled by the host's installed `zfb css` command.
- Keep token overrides in the existing `:root` rules and utility mappings in
  `wind.tokens`. Do not add a duplicate reset, a separate utility stylesheet,
  or another theme path to work around the old color-reset behavior.

## Quick Rules (always apply)

### Component first

- Prefer configured zudo-wind utilities and reusable components over one-off
  classes.
- Use props for component variants where a component owns the behavior.
- When a used utility form is unsupported, add a scoped, unlayered `zc-*` rule
  in the category stylesheet, following `packages/demo-ui/STORIES.md`.

### Design Tokens (no arbitrary values)

- Use only configured semantic colors; a utility is available only when it is
  part of the composed wind token map or manifest.
- **NEVER** use arbitrary values (`text-[0.875rem]`, `p-[1.2rem]`) when a token exists
- **NEVER** use hardcoded hex values in components
- Spacing (shared everywhere — root, `packages/demo-ui`, `apps/demo`): `hsp-*` (horizontal),
  `vsp-*` (vertical), 7-8 steps `2xs`/`3xs`→`2xl`. Defined once in `packages/demo-ui/styles/tokens.css`.
- Typography (shared, same file): Tier 1 abstract sizes `text-xs`…`text-2xl` (each with a paired
  line-height), plus Tier 2 semantic aliases `text-micro`/`caption`/`small`/`body`/`heading`/`display`
  (each a `var()` onto a Tier-1 rung). Which tier to use depends on which world you're in — see below.

### Two Worlds: doc-chrome vs. `@zudo-sg/demo-ui` components

This monorepo has two independent semantic **color** layers sharing the one spacing/typography
token file above. Know which world the file you're editing belongs to:

- **Doc-chrome world** (root-only: `src/**`, `pages/**` — the styleguide host's own header,
  sidebar, search, doc prose, panels): colors come from `src/styles/global.css`'s `--zd-*` →
  `--color-*` values, with the utility-name mapping in `zfb.config.ts`'s
  `wind.tokens`. Use configured roles such as `text-fg`, `bg-surface`,
  `border-border`, and `text-accent`. The raw `--palette-*` values are CSS
  properties, not utility names. Doc prose (`.zd-content`) consumes the
  Tier-2 typography aliases (`text-body`, `text-caption`, ...) from
  `@takazudo/zudo-doc`'s `content.css`.
- **UI-component world** (`packages/demo-ui/src/**`, also consumed by `apps/demo` and by the root's
  `/components/*` catalog): colors come from `packages/demo-ui/styles/colors.css`'s semantic tokens —
  `bg`, `surface`/`surface-2`, `border`, `fg`/`muted`, `accent`/`accent-hover`, `on-accent`,
  `focus`, `success`/`danger`/`warning`/`info`, `loading-scrim`, and the persistent-dark-nav
  `rail-*` family (`rail-bg`, `rail-bg-strong`, `rail-fg`, `rail-muted`, `rail-border`,
  `rail-hover-bg` — intentionally NOT a `light-dark()` pair; it stays dark in both schemes).
  All ~70 components use the **Tier-2 semantic** typography aliases directly (`text-body`,
  `text-title`, `text-caption`, ...) — this is the inverse of the doc-chrome convention, and the
  inverse of what this section used to say before the port: there is no longer any component
  in this package using the Tier-1 abstract sizes (`text-sm`, `text-lg`, ...) directly. See
  `packages/demo-ui/styles/tokens.css`'s header comment for the two-tier rationale.
- Ten token **names** exist in both worlds (`bg`, `fg`, `surface`, `muted`, `accent`,
  `accent-hover`, `success`, `danger`, `warning`, `info` — widened from an original four when
  the UI palette adopted these names). On root-host pages `global.css` declares these ten
  `--color-*` properties after the shared colors stylesheet and points them at `--zd-*`, so
  root-rendered `@zudo-sg/demo-ui` components match the docs palette. The root `wind.tokens`
  map resolves their utility names through those live properties. In `apps/demo` (without those
  declarations), the same ten names resolve to `@zudo-sg/demo-ui`'s own values. The remaining
  UI-only names (`surface-2`, `focus`, `on-accent`, `loading-scrim`, the `rail-*` family) stay
  with the component library. **`border` is the one exception**: root `global.css` declares
  its own `--color-border` and `--color-border-strong` for the border ladder, which the root
  wind map exposes to the catalog. Never assume a color utility means the same thing in both
  worlds — check which host config and stylesheet provide it.
- The chrome-free `/components/preview` iframe document (`<html data-sg-preview-doc>`) has no
  `--zd-*` injected, so it links a standalone preview stylesheet: `src/styles/preview-entry.css`
  (`previewStyles`), compiled by `@takazudo/zudo-sg/plugins/preview-css` and served/emitted at
  `/_zudo-sg/preview.css`. Its token roots are rescoped to `:root[data-sg-preview-doc]`, which
  has greater specificity than the host's plain `:root` token rules, so the previewed components
  get `@zudo-sg/demo-ui`'s own palette while regular doc-chrome pages are untouched.

### Color Tokens (three-tier system)

Both worlds follow the same three-tier shape (palette → semantic → component), just with
different concrete tokens:

- **Doc-chrome** (`src/styles/global.css`):
  - **Tier 1** (palette): raw `--palette-*` custom properties supplied by the
    zudo-doc color-scheme provider; they are values beneath the semantic roles.
  - **Tier 2** (semantic): `text-fg`, `bg-surface`, `border-border`,
    `border-border-strong`, `text-accent` — prefer these configured utilities.
- **UI-component** (`packages/demo-ui/styles/colors.css`):
  - **Tier 1** (`--palette-{group}-{n}`): raw oklch values, GROUPED by role family —
    `base` (warm-neutral ramp), `accent` (amber action ramp), `state`
    (danger/success/warning/info), and a `line-*` ramp per business line. Plain
    `:root` variables. The wind token map exposes semantic roles, not palette
    utility names, so components use Tier 2 tokens.
  - **Tier 2** (`--color-*`): semantic roles, each a `light-dark()` pair of Tier-1 refs — this is
    what components bind to (`bg-accent`, `text-fg`, ...)
  - Full contract + rationale: `packages/demo-ui/STORIES.md` §"Three-tier color system"

### Border ladder

The complete structural border ladder is defined in `src/styles/global.css`.
The preview document's standalone stylesheet (`/_zudo-sg/preview.css`) carries only the
provider's own `--color-border`; it does not mirror the host-only `--color-border-strong`:

| Token | Role |
|---|---|
| `--color-border` | Sitewide hairline border — the border-ladder default. **Never** substitute `--color-muted` (a text-color token) for a border. |
| `--color-border-strong` | Major divisions (for example a bordered modal or panel edge) — one step up from `--color-border`. |

Use the default border for catalog cards, panel dividers, and quiet structural
separation. Use the strong border only when the hierarchy genuinely needs a
second rung. Never substitute `--color-muted`, because it is a text color.

### Accent budget in the styleguide

Audit the actual viewport at rest. Catalog cards, code-panel dividers, resizers,
search results, and token controls should normally use neutral foreground,
surface, and border roles. Accent is reserved for focus, selection/current
state, pressed controls, and the primary action. A hover-only state does not
qualify; use a neutral foreground mix or border-strength change instead.

Functional labels stay at `--text-caption` or larger. `--text-micro` is only
for true metadata such as counts or timestamps, and must not be combined with
uppercase letter-spacing to simulate importance.

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

### Server-rendered zudo-react components and client islands

- Default to **server-rendered zudo-react `.tsx`** with no island activation — emits zero JS. See root `CLAUDE.md`'s
  "Components" section for the canonical rule.
- Promote to a **client island** only when interactivity is needed: mark the module
  `"use client"` and mount it via zfb's `<Island>` wrapper (see `pages/lib/_body-end-islands.tsx`)
- Both follow the same utility-class approach
