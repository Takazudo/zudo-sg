# @zudo-sg/ui — reference-component token map

Mechanical mapping table for the **port batches** that move the reference
implementation's site components into `@zudo-sg/ui`. Every design-token
utility / CSS var those components use is listed here with its **new** @zudo-sg/ui
equivalent. Apply this table mechanically per component; where a row says
_rename_, change the class; where it says _same_, leave it.

Sources of truth: `packages/ui/styles/colors.css` (colors) and
`packages/ui/styles/tokens.css` (text / z-index / radius / leading). This table
was built against the full, deduplicated utility inventory of
the reference implementation's site components (every distinct utility below actually appears there).

Two things to internalise before porting:

1. **Colors map 1:1 by name.** @zudo-sg/ui adopted the reference's own Tier-2
   color names (`bg`, `surface`, `surface-2`, `border`, `fg`, `muted`, `accent`,
   `accent-hover`, the `rail-*` family, `loading-scrim`). So `bg-surface` stays
   `bg-surface`, `text-rail-fg` stays `text-rail-fg`, etc. No color class needs
   renaming.
2. **Text sizes shift by one rung, and z-index is namespaced.** These are the
   only renames. See §3 and §4.

---

## 1. Color utilities — 1:1 (no rename)

Every color utility used by the reference components keeps its class name. The
values now come from the warm grouped palette (amber accent, warm-gray base,
warm dark rail) instead of the reference's blue/navy, but the token _names_ are
identical, so the classes are unchanged.

| Reference utility (any `bg-/text-/border-/outline-/ring-/…` prefix) | @zudo-sg/ui | Note |
|---|---|---|
| `…-bg` | `…-bg` | same |
| `…-surface` | `…-surface` | same |
| `…-surface-2` | `…-surface-2` | same |
| `…-border` | `…-border` | same |
| `…-fg` | `…-fg` | same |
| `…-muted` | `…-muted` | same |
| `…-accent` | `…-accent` | same |
| `…-accent-hover` | `…-accent-hover` | same |
| `…-rail-bg` | `…-rail-bg` | same |
| `…-rail-bg-strong` | `…-rail-bg-strong` | same |
| `…-rail-fg` | `…-rail-fg` | same |
| `…-rail-muted` | `…-rail-muted` | same |
| `…-rail-border` | `…-rail-border` | same |
| `…-rail-hover-bg` | `…-rail-hover-bg` | same |
| `…-loading-scrim` | `…-loading-scrim` | same |

Confirmed present in the reference implementation's site components: `text-fg`, `text-muted`,
`border-border`, `text-accent`, `text-rail-fg`, `border-accent`,
`text-rail-muted`, `bg-bg`, `bg-surface`, `bg-rail-hover-bg`, `border-rail-border`,
`outline-rail-fg`, `text-bg`, `outline-accent`, `bg-rail-bg-strong`, `bg-border`,
`text-accent-hover`, `bg-rail-fg`, `bg-rail-bg`, `border-accent-hover`,
`bg-accent-hover`, `text-border`, `border-bg`, `bg-rail-border`, `bg-accent`.

### On-accent labels

The reference labels filled-accent buttons with **`text-bg`** (the page-bg color
used as foreground — it flips with the scheme, so it stays readable on the
scheme-appropriate accent). That maps 1:1 to `text-bg` and still works.
@zudo-sg/ui additionally ships a semantic **`--color-on-accent`** (`text-on-accent`)
with the same light/dark behaviour — prefer it in new/edited markup for clarity,
but `text-bg` needs no change.

### State colors

The reference implementation's site components use **no** `success` / `danger` / `warning` / `info`
utilities (the reference's design system had no state colors). @zudo-sg/ui defines
them anyway (`bg-success`, `text-danger`, …, `light-dark()` pairs from
`color-schemes.ts`) for the existing 11 components and future needs.

---

## 2. Business-line accents (`[data-line="<key>"]`)

The reference does **not** put line colors on components. Instead
the reference's per-line theming stylesheet sets `<html data-line="<key>">` and overrides the
Tier-2 `--color-accent` / `--color-accent-hover`; components just use the normal
`text-accent` / `bg-accent` / `border-accent` utilities and cascade-follow. So
**no component markup changes for lines** — only the port's `[data-line]` override
block changes its values, from the reference's flat hex to the new grouped
`--palette-line-*` rungs (which are AA on light **and** dark surfaces, so the
override should be a `light-dark()` pair):

```css
[data-line="vacuum"] {
  --color-accent:       light-dark(var(--palette-line-vacuum-accent),  var(--palette-line-vacuum-accent-dark));
  --color-accent-hover: light-dark(var(--palette-line-vacuum-hover),   var(--palette-line-vacuum-hover-dark));
}
/* …process / laser / meeting / beauty identically, swapping the key… */
```

| Line key | Reference accent / hover (hex, light-only) | New Tier-1 rungs (light + dark) |
|---|---|---|
| `vacuum`  | `#0e8f9e` / `#0a6d78` | `--palette-line-vacuum-accent{,-dark}` · `--palette-line-vacuum-hover{,-dark}` |
| `process` | `#7c3aed` / `#6d28d9` | `--palette-line-process-accent{,-dark}` · `--palette-line-process-hover{,-dark}` |
| `laser`   | `#dc2626` / `#b91c1c` | `--palette-line-laser-accent{,-dark}` · `--palette-line-laser-hover{,-dark}` |
| `meeting` | `#15803d` / `#166534` | `--palette-line-meeting-accent{,-dark}` · `--palette-line-meeting-hover{,-dark}` |
| `beauty`  | `#db2777` / `#be185d` | `--palette-line-beauty-accent{,-dark}` · `--palette-line-beauty-hover{,-dark}` |

The hues were re-derived in OKLCH into a unified light+dark AA envelope (each
line keeps its identity hue; the scheme's rail/accent are warm, not the
reference's blue/navy). Raw values live in `colors.css` Tier-1.

---

## 3. Font-size utilities — RENAME (shift one rung)

@zudo-sg/ui's semantic size scale differs from the reference's by one rung
(`text-body` is 20px here vs 16px there — it is a locked external contract used by
zudo-doc prose and cannot move). **Map by pixel size** so ported components keep
their intended sizes:

| Reference utility | px | @zudo-sg/ui utility | px | Action |
|---|---|---|---|---|
| `text-caption` | 12 | `text-micro`   | 12 | **rename** |
| `text-small`   | 14 | `text-caption` | 14 | **rename** |
| `text-body`    | 16 | `text-small`   | 16 | **rename** |
| `text-title`   | 20 | `text-title`   | 20 | same |
| `text-heading` | 28 | `text-heading` | 28 | same |
| `text-display` | 40 | `text-display` | 40 | same |

Used by components (confirmed): `text-body`, `text-caption`, `text-small`,
`text-title`, `text-heading`, `text-display`. No `text-scale-*` is used in
components (styleguide-only). If a future component uses the raw scale, map
`text-scale-{2xs,sm,md,lg,xl,2xl}` → `text-{xs,sm,base,lg,xl,2xl}` (both by px);
the reference's `text-scale-xs` (13px) has no @zudo-sg/ui rung — use `text-xs` (12px).

---

## 4. Z-index utilities — RENAME (`z-ui-` prefix)

@zudo-sg/ui's semantic z scale is namespaced `--z-index-ui-*` to stay collision-free
with the doc host's own `z-*` scale (which owns `dropdown`/`modal`/`toast`). Rename:

| Reference utility | @zudo-sg/ui utility | value |
|---|---|---|
| `z-base`     | `z-ui-base`     | 0 |
| `z-sticky`   | `z-ui-sticky`   | 10 |
| `z-dropdown` | `z-ui-dropdown` | 20 |
| `z-overlay`  | `z-ui-overlay`  | 30 |
| `z-modal`    | `z-ui-modal`    | 40 |
| `z-toast`    | `z-ui-toast`    | 50 |

Used by components (confirmed): `z-sticky`, `z-dropdown`, `z-overlay`, `z-modal`.
Raw `var(--z-index-<name>)` → `var(--z-index-ui-<name>)`.

---

## 5. Radius utilities

| Reference utility | px | @zudo-sg/ui | Action |
|---|---|---|---|
| `rounded` | 4 | `rounded` | same (`--radius-DEFAULT` = 4px) |
| `rounded-lg` | 8 | `rounded-md` | **rename** (@zudo-sg/ui `rounded-lg` is **16px**; use `rounded-md` = 8px to keep the size) |
| `rounded-md` | 8 | `rounded-md` | same (8px) |
| `rounded-full` | pill | `rounded-full` | same |

Used by components (confirmed): `rounded`, `rounded-lg`, `rounded-md`,
`rounded-full`.

---

## 6. Line-height utilities

| Reference utility | @zudo-sg/ui | Note |
|---|---|---|
| `leading-none` | `leading-none` | same (Tailwind static `line-height: 1`) |
| `leading-tight` | `leading-tight` | same (1.25) |
| `leading-snug` | `leading-snug` | same (1.4 — added to `tokens.css`) |
| `leading-relaxed` | `leading-relaxed` | value differs: ref 1.7 → @zudo-sg/ui **1.75** (accept, or set an arbitrary `leading-[1.7]` if exact) |

Used by components (confirmed): `leading-none`, `leading-tight`, `leading-snug`,
`leading-relaxed`.

---

## 7. Spacing (context)

Not renamed — the `hsp-*` / `vsp-*` axis names are identical. **But the pixel
values differ** between the reference and @zudo-sg/ui (e.g. reference `hsp-2xs` = 4px
vs @zudo-sg/ui 2px; reference `vsp-xl` = 64px vs @zudo-sg/ui 40px). Ported layouts will
shift; verify spacing-sensitive components visually and adjust the axis step
where the design needs it. A full spacing remap is out of scope for this map
(color / z-index / text are the renaming surface).

---

## 8. Raw `var(--token)` references (not utility classes)

Some components reference tokens directly in `style={{}}` / arbitrary values
(e.g. `color-mix(in oklch, var(--color-accent) 8%, transparent)`, a `clamp()`
on `var(--text-display)`, or `var(--radius-lg)` in a `.stories.tsx`). A raw
`var()` is NOT caught by the utility-class renames above, so apply the SAME
remap to the custom-property name:

| Raw ref in reference | @zudo-sg/ui | Note |
|---|---|---|
| `var(--color-<name>)` | `var(--color-<name>)` | same — colors are 1:1 by name (accent/bg/border/surface/fg/muted, all observed in `color-mix` tints) |
| `var(--text-caption)` | `var(--text-micro)` | 12px — same shift-one-rung as §3 |
| `var(--text-small)` | `var(--text-caption)` | 14px |
| `var(--text-body)` | `var(--text-small)` | 16px |
| `var(--text-title|--text-heading|--text-display)` | unchanged | same px |
| `var(--radius-lg)` | `var(--radius-md)` | 8px — @zudo-sg/ui `--radius-lg` is 16px (see §5) |

No raw `var(--z-index-*)`, `var(--leading-*)`, or `var(--ds-*)` references exist
in the reference components. (`--color-loading-scrim` appears only in a doc
comment; the loading-overlay component defers its color to a stylesheet.)
