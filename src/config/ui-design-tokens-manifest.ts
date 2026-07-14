/**
 * Design-token manifest for @zudo-sg/ui target-website tokens.
 *
 * GENERATED — do not hand-edit. Run `pnpm gen:token-manifest` after changing
 * packages/ui/styles/tokens.css or packages/ui/styles/colors.css, then commit
 * the regenerated output. `pnpm check:token-manifest` fails on drift.
 *
 * Source of truth: packages/ui/styles/tokens.css and packages/ui/styles/colors.css,
 * parsed by scripts/gen-token-manifest.mjs (scripts/lib/ui-token-manifest.mjs).
 * Only `default` values are derived from the CSS; `group`/`step`/`unit`/
 * `control`/`options`/`pill` are presentation metadata with no CSS
 * equivalent and are configured in that script's SPECS tables.
 *
 * Covers: Color / Spacing / Font / Size tabs.
 * Does NOT include any --zd-* doc-chrome tokens.
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Tier-1 raw palette colors from `packages/ui/styles/colors.css` (the `:root`
 * `--palette-{group}-{step-or-role}` block). This is the raw material beneath the
 * semantic `--color-*` tokens in UI_COLOR_TOKENS below — same three-tier
 * model the doc-chrome panel exposes via `--palette-*` ramps and `--zd-*`
 * semantic roles.
 *
 * These are plain name/value descriptors (NOT `TokenDef`) because zdtp's
 * `TokenDef.control` has no `"color"` option — the preview panel builds them
 * into `{ kind: "color" }` TierItems inline, mirroring the doc panel's
 * ramp tiers. Rendered as a "Palette" swatch tier in the preview
 * panel's Color tab; editing a swatch pushes `--palette-*` to the preview
 * iframes via the sink, cascading into every semantic token that references it.
 *
 * Coverage: 36 colors.
 */
export interface UiPaletteColor {
  /** Palette key without the `--palette-` prefix, e.g. "neutral-2". */
  name: string;
  /** Raw oklch value, from colors.css. */
  value: string;
}

export const UI_PALETTE_COLORS: readonly UiPaletteColor[] = [
  { name: "neutral-0", value: "oklch(0.970 0.006 75)" },
  { name: "neutral-1", value: "oklch(0.885 0.009 75)" },
  { name: "neutral-2", value: "oklch(0.410 0.012 75)" },
  { name: "neutral-3", value: "oklch(0.235 0.010 75)" },
  { name: "accent-0", value: "oklch(.755 .130 64)" },
  { name: "accent-1", value: "oklch(.700 .158 62)" },
  { name: "accent-2", value: "oklch(.470 .120 56)" },
  { name: "accent-3", value: "oklch(.400 .096 56)" },
  { name: "state-danger", value: "oklch(.505 .170 25)" },
  { name: "state-danger-dark", value: "oklch(.655 .170 25)" },
  { name: "state-success", value: "oklch(.470 .140 145)" },
  { name: "state-success-dark", value: "oklch(.680 .145 145)" },
  { name: "state-warning", value: "oklch(.490 .100 82)" },
  { name: "state-warning-dark", value: "oklch(.760 .135 82)" },
  { name: "state-info", value: "oklch(.485 .122 245)" },
  { name: "state-info-dark", value: "oklch(.680 .130 245)" },
  { name: "line-vacuum-accent", value: "oklch(.525 .100 200)" },
  { name: "line-vacuum-accent-dark", value: "oklch(.760 .085 200)" },
  { name: "line-vacuum-hover", value: "oklch(.460 .088 200)" },
  { name: "line-vacuum-hover-dark", value: "oklch(.830 .070 200)" },
  { name: "line-process-accent", value: "oklch(.530 .150 300)" },
  { name: "line-process-accent-dark", value: "oklch(.720 .130 300)" },
  { name: "line-process-hover", value: "oklch(.455 .140 300)" },
  { name: "line-process-hover-dark", value: "oklch(.795 .110 300)" },
  { name: "line-laser-accent", value: "oklch(.555 .175 28)" },
  { name: "line-laser-accent-dark", value: "oklch(.700 .165 28)" },
  { name: "line-laser-hover", value: "oklch(.478 .168 28)" },
  { name: "line-laser-hover-dark", value: "oklch(.775 .140 28)" },
  { name: "line-meeting-accent", value: "oklch(.525 .132 150)" },
  { name: "line-meeting-accent-dark", value: "oklch(.740 .125 150)" },
  { name: "line-meeting-hover", value: "oklch(.458 .116 150)" },
  { name: "line-meeting-hover-dark", value: "oklch(.815 .105 150)" },
  { name: "line-beauty-accent", value: "oklch(.565 .172 350)" },
  { name: "line-beauty-accent-dark", value: "oklch(.720 .150 350)" },
  { name: "line-beauty-hover", value: "oklch(.485 .166 350)" },
  { name: "line-beauty-hover-dark", value: "oklch(.795 .130 350)" },
];

/**
 * Color tokens from `packages/ui/styles/colors.css`.
 *
 * All values use light-dark() for dual-scheme support. Defaults here are
 * the full CSS declarations including both light and dark sides.
 * Stored as read-only text rows because light-dark() expressions cannot
 * be driven by a single-axis slider.
 *
 * Coverage: 21 tokens total.
 */
export const UI_COLOR_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-color-bg",
    cssVar: "--color-bg",
    label: "color-bg",
    group: "surface",
    default: "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-surface",
    cssVar: "--color-surface",
    label: "color-surface",
    group: "surface",
    default: "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-surface-2",
    cssVar: "--color-surface-2",
    label: "color-surface-2",
    group: "surface",
    default: "light-dark(var(--palette-neutral-1), var(--palette-neutral-2))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-border",
    cssVar: "--color-border",
    label: "color-border",
    group: "surface",
    default: "light-dark(var(--palette-neutral-1), var(--palette-neutral-2))",
    step: 1,
    unit: "",
    control: "text",
  },
  // Translucent frost scrim derived from --color-bg (SPA loading overlay).
  {
    id: "ui-color-loading-scrim",
    cssVar: "--color-loading-scrim",
    label: "color-loading-scrim",
    group: "surface",
    default: "color-mix(in srgb, var(--color-bg) 40%, transparent)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-fg",
    cssVar: "--color-fg",
    label: "color-fg",
    group: "text",
    default: "light-dark(var(--palette-neutral-3), var(--palette-neutral-0))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-muted",
    cssVar: "--color-muted",
    label: "color-muted",
    group: "text",
    default: "light-dark(var(--palette-neutral-2), var(--palette-neutral-1))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-accent",
    cssVar: "--color-accent",
    label: "color-accent",
    group: "accent",
    default: "light-dark(var(--palette-accent-2), var(--palette-accent-1))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-accent-hover",
    cssVar: "--color-accent-hover",
    label: "color-accent-hover",
    group: "accent",
    default: "light-dark(var(--palette-accent-3), var(--palette-accent-0))",
    step: 1,
    unit: "",
    control: "text",
  },
  // Foreground token for text/icons on filled accent/state surfaces (consumed via `text-on-accent`).
  {
    id: "ui-color-on-accent",
    cssVar: "--color-on-accent",
    label: "color-on-accent",
    group: "accent",
    default: "light-dark(var(--palette-neutral-0), var(--palette-neutral-3))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-focus",
    cssVar: "--color-focus",
    label: "color-focus",
    group: "accent",
    default: "light-dark(var(--palette-accent-2), var(--palette-accent-1))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-bg",
    cssVar: "--color-rail-bg",
    label: "color-rail-bg",
    group: "rail",
    default: "var(--palette-neutral-3)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-bg-strong",
    cssVar: "--color-rail-bg-strong",
    label: "color-rail-bg-strong",
    group: "rail",
    default: "var(--palette-neutral-3)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-fg",
    cssVar: "--color-rail-fg",
    label: "color-rail-fg",
    group: "rail",
    default: "var(--palette-neutral-0)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-muted",
    cssVar: "--color-rail-muted",
    label: "color-rail-muted",
    group: "rail",
    default: "var(--palette-neutral-1)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-border",
    cssVar: "--color-rail-border",
    label: "color-rail-border",
    group: "rail",
    default: "var(--palette-neutral-2)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-rail-hover-bg",
    cssVar: "--color-rail-hover-bg",
    label: "color-rail-hover-bg",
    group: "rail",
    default: "var(--palette-neutral-2)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-success",
    cssVar: "--color-success",
    label: "color-success",
    group: "state",
    default: "light-dark(var(--palette-state-success), var(--palette-state-success-dark))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-danger",
    cssVar: "--color-danger",
    label: "color-danger",
    group: "state",
    default: "light-dark(var(--palette-state-danger), var(--palette-state-danger-dark))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-warning",
    cssVar: "--color-warning",
    label: "color-warning",
    group: "state",
    default: "light-dark(var(--palette-state-warning), var(--palette-state-warning-dark))",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-color-info",
    cssVar: "--color-info",
    label: "color-info",
    group: "state",
    default: "light-dark(var(--palette-state-info), var(--palette-state-info-dark))",
    step: 1,
    unit: "",
    control: "text",
  },
];

/**
 * Spacing tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 15 tokens total.
 */
export const UI_SPACING_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-hsp-2xs",
    cssVar: "--spacing-hsp-2xs",
    label: "hsp-2xs",
    group: "hsp",
    default: "0.125rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-xs",
    cssVar: "--spacing-hsp-xs",
    label: "hsp-xs",
    group: "hsp",
    default: "0.375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-sm",
    cssVar: "--spacing-hsp-sm",
    label: "hsp-sm",
    group: "hsp",
    default: "0.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-md",
    cssVar: "--spacing-hsp-md",
    label: "hsp-md",
    group: "hsp",
    default: "0.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-lg",
    cssVar: "--spacing-hsp-lg",
    label: "hsp-lg",
    group: "hsp",
    default: "1rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-xl",
    cssVar: "--spacing-hsp-xl",
    label: "hsp-xl",
    group: "hsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-hsp-2xl",
    cssVar: "--spacing-hsp-2xl",
    label: "hsp-2xl",
    group: "hsp",
    default: "2rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-3xs",
    cssVar: "--spacing-vsp-3xs",
    label: "vsp-3xs",
    group: "vsp",
    default: "0.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-2xs",
    cssVar: "--spacing-vsp-2xs",
    label: "vsp-2xs",
    group: "vsp",
    default: "0.4375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-xs",
    cssVar: "--spacing-vsp-xs",
    label: "vsp-xs",
    group: "vsp",
    default: "0.875rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-sm",
    cssVar: "--spacing-vsp-sm",
    label: "vsp-sm",
    group: "vsp",
    default: "1.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-md",
    cssVar: "--spacing-vsp-md",
    label: "vsp-md",
    group: "vsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-lg",
    cssVar: "--spacing-vsp-lg",
    label: "vsp-lg",
    group: "vsp",
    default: "1.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-xl",
    cssVar: "--spacing-vsp-xl",
    label: "vsp-xl",
    group: "vsp",
    default: "2.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "ui-vsp-2xl",
    cssVar: "--spacing-vsp-2xl",
    label: "vsp-2xl",
    group: "vsp",
    default: "3.5rem",
    step: 0.025,
    unit: "rem",
  },
];

/**
 * Font tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 22 tokens total.
 */
export const UI_FONT_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-text-xs",
    cssVar: "--text-xs",
    label: "text-xs",
    group: "font-size",
    default: "0.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-sm",
    cssVar: "--text-sm",
    label: "text-sm",
    group: "font-size",
    default: "0.875rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-base",
    cssVar: "--text-base",
    label: "text-base",
    group: "font-size",
    default: "1rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-lg",
    cssVar: "--text-lg",
    label: "text-lg",
    group: "font-size",
    default: "1.25rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-xl",
    cssVar: "--text-xl",
    label: "text-xl",
    group: "font-size",
    default: "1.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-2xl",
    cssVar: "--text-2xl",
    label: "text-2xl",
    group: "font-size",
    default: "2.5rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "ui-text-xs--line-height",
    cssVar: "--text-xs--line-height",
    label: "text-xs / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-sm--line-height",
    cssVar: "--text-sm--line-height",
    label: "text-sm / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-base--line-height",
    cssVar: "--text-base--line-height",
    label: "text-base / lh",
    group: "font-size-lh",
    default: "1.75",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-lg--line-height",
    cssVar: "--text-lg--line-height",
    label: "text-lg / lh",
    group: "font-size-lh",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-xl--line-height",
    cssVar: "--text-xl--line-height",
    label: "text-xl / lh",
    group: "font-size-lh",
    default: "1.25",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-text-2xl--line-height",
    cssVar: "--text-2xl--line-height",
    label: "text-2xl / lh",
    group: "font-size-lh",
    default: "1.1",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-font-weight-normal",
    cssVar: "--font-weight-normal",
    label: "font-weight-normal",
    group: "font-weight",
    default: "400",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-medium",
    cssVar: "--font-weight-medium",
    label: "font-weight-medium",
    group: "font-weight",
    default: "500",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-semibold",
    cssVar: "--font-weight-semibold",
    label: "font-weight-semibold",
    group: "font-weight",
    default: "600",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-font-weight-bold",
    cssVar: "--font-weight-bold",
    label: "font-weight-bold",
    group: "font-weight",
    default: "700",
    step: 1,
    unit: "",
    control: "select",
    options: FONT_WEIGHT_OPTIONS,
  },
  {
    id: "ui-leading-tight",
    cssVar: "--leading-tight",
    label: "leading-tight",
    group: "line-height",
    default: "1.25",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-leading-snug",
    cssVar: "--leading-snug",
    label: "leading-snug",
    group: "line-height",
    default: "1.4",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-leading-normal",
    cssVar: "--leading-normal",
    label: "leading-normal",
    group: "line-height",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-leading-relaxed",
    cssVar: "--leading-relaxed",
    label: "leading-relaxed",
    group: "line-height",
    default: "1.75",
    step: 0.05,
    unit: "",
  },
  {
    id: "ui-font-sans",
    cssVar: "--font-sans",
    label: "font-sans",
    group: "font-family",
    default: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-font-mono",
    cssVar: "--font-mono",
    label: "font-mono",
    group: "font-family",
    default: "ui-monospace, \"JetBrains Mono\", \"Fira Code\", monospace",
    step: 1,
    unit: "",
    control: "text",
  },
];

/**
 * Size tokens from `packages/ui/styles/tokens.css`.
 *
 * Coverage: 8 tokens total.
 * `--radius-full` carries a pill toggle (sentinel 9999px).
 */
export const UI_SIZE_TOKENS: readonly TokenDef[] = [
  {
    id: "ui-radius-DEFAULT",
    cssVar: "--radius-DEFAULT",
    label: "radius-DEFAULT",
    group: "radius",
    default: "0.25rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-sm",
    cssVar: "--radius-sm",
    label: "radius-sm",
    group: "radius",
    default: "0.25rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-md",
    cssVar: "--radius-md",
    label: "radius-md",
    group: "radius",
    default: "0.5rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-lg",
    cssVar: "--radius-lg",
    label: "radius-lg",
    group: "radius",
    default: "1rem",
    step: 1,
    unit: "px",
  },
  {
    id: "ui-radius-full",
    cssVar: "--radius-full",
    label: "radius-full",
    group: "radius",
    default: "9999px",
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },
  {
    id: "ui-shadow-card",
    cssVar: "--shadow-card",
    label: "shadow-card",
    group: "shadow",
    default: "0 0.5px 1px oklch(.185 .005 65 / 0.05), 0 2px 4px oklch(.185 .005 65 / 0.05), 0 5px 10px oklch(.185 .005 65 / 0.05)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-raised",
    cssVar: "--shadow-raised",
    label: "shadow-raised",
    group: "shadow",
    default: "0 1px 2px oklch(.185 .005 65 / 0.06), 0 4px 8px oklch(.185 .005 65 / 0.06), 0 12px 24px oklch(.185 .005 65 / 0.07)",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "ui-shadow-overlay",
    cssVar: "--shadow-overlay",
    label: "shadow-overlay",
    group: "shadow",
    default: "0 2px 4px oklch(.185 .005 65 / 0.08), 0 8px 16px oklch(.185 .005 65 / 0.08), 0 24px 48px oklch(.185 .005 65 / 0.10)",
    step: 1,
    unit: "",
    control: "text",
  },
];
