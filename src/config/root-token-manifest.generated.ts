/**
 * Design-token manifest for the zudo-sg ROOT host — GENERATE-ONLY scratch
 * output (#210). NOT wired into any consumer yet; the hand-maintained
 * src/config/design-tokens-manifest.ts is still the manifest the panel and
 * serde actually use. This file exists as generator evidence for the
 * follow-up wire-in sub-issue.
 *
 * GENERATED — do not hand-edit. Run
 * `node scripts/gen-root-token-manifest.mjs` after changing
 * packages/ui/styles/tokens.css, packages/ui/styles/colors.css, or
 * src/styles/global.css, then commit the regenerated output.
 * `node scripts/gen-root-token-manifest.mjs --check` fails on drift.
 *
 * Source of truth, resolved via scripts/lib/css-var-resolver.mjs (#209) in
 * @import cascade order — this order MUST track global.css's own @import
 * lines, see the call-site comment in scripts/gen-root-token-manifest.mjs:
 *   1. packages/ui/styles/tokens.css  (shared spacing/font/radius/shadow/transition)
 *   2. packages/ui/styles/colors.css  (shared semantic colors — no spacing/font/size tokens)
 *   3. src/styles/global.css itself   (root-specific @theme/:root overrides win on collision,
 *                                       e.g. --radius-lg, --radius-DEFAULT, --leading-snug,
 *                                       --spacing-icon-*)
 *
 * Only `default` values are derived from the CSS. The two LOCKED canonical
 * unit transforms (rem -> px at 16px/rem, s -> ms) are applied per-token so
 * generated defaults preserve the current hand-file unit SHAPES exactly
 * (e.g. --radius-lg -> "8px", --default-transition-duration -> "150ms").
 * `group`/`step`/`unit`/`control`/`options`/`pill`/`readonly` are
 * presentation metadata with no CSS equivalent and are configured in this
 * script's SPECS tables (scripts/lib/root-token-manifest.mjs).
 *
 * `sidebar-w` (--zd-sidebar-w) is a manually-flagged readonly literal, not
 * derived from CSS — its clamp() expression is out of scope for this
 * generator (see scripts/lib/root-token-manifest.mjs).
 *
 * COLOR_TOKENS is intentionally empty (v1): --zd-surface and its siblings
 * are injected by ColorSchemeProvider at runtime and have no static CSS
 * declaration anywhere in the three source files to resolve.
 */
import type { TokenDef } from "@takazudo/zdtp";

// --- Font weight select options ---
const FONT_WEIGHT_OPTIONS = [
  "100", "200", "300", "400", "500", "600", "700", "800", "900",
] as const;

/**
 * Spacing tokens from `global.css` (hsp/vsp/spacing-0/spacing-px come from
 * the shared tokens.css it imports; icon sizes, image-overlay-inset, and
 * sidebar-w are root-specific).
 *
 * Coverage: 23 tokens total.
 */
export const SPACING_TOKENS: readonly TokenDef[] = [
  {
    id: "hsp-2xs",
    cssVar: "--spacing-hsp-2xs",
    label: "hsp-2xs",
    group: "hsp",
    default: "0.125rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-xs",
    cssVar: "--spacing-hsp-xs",
    label: "hsp-xs",
    group: "hsp",
    default: "0.375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-sm",
    cssVar: "--spacing-hsp-sm",
    label: "hsp-sm",
    group: "hsp",
    default: "0.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-md",
    cssVar: "--spacing-hsp-md",
    label: "hsp-md",
    group: "hsp",
    default: "0.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-lg",
    cssVar: "--spacing-hsp-lg",
    label: "hsp-lg",
    group: "hsp",
    default: "1rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-xl",
    cssVar: "--spacing-hsp-xl",
    label: "hsp-xl",
    group: "hsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "hsp-2xl",
    cssVar: "--spacing-hsp-2xl",
    label: "hsp-2xl",
    group: "hsp",
    default: "2rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-3xs",
    cssVar: "--spacing-vsp-3xs",
    label: "vsp-3xs",
    group: "vsp",
    default: "0.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-2xs",
    cssVar: "--spacing-vsp-2xs",
    label: "vsp-2xs",
    group: "vsp",
    default: "0.4375rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-xs",
    cssVar: "--spacing-vsp-xs",
    label: "vsp-xs",
    group: "vsp",
    default: "0.875rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-sm",
    cssVar: "--spacing-vsp-sm",
    label: "vsp-sm",
    group: "vsp",
    default: "1.25rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-md",
    cssVar: "--spacing-vsp-md",
    label: "vsp-md",
    group: "vsp",
    default: "1.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-lg",
    cssVar: "--spacing-vsp-lg",
    label: "vsp-lg",
    group: "vsp",
    default: "1.75rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-xl",
    cssVar: "--spacing-vsp-xl",
    label: "vsp-xl",
    group: "vsp",
    default: "2.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "vsp-2xl",
    cssVar: "--spacing-vsp-2xl",
    label: "vsp-2xl",
    group: "vsp",
    default: "3.5rem",
    step: 0.025,
    unit: "rem",
  },
  {
    id: "icon-xs",
    cssVar: "--spacing-icon-xs",
    label: "icon-xs",
    group: "icon",
    default: "0.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "icon-sm",
    cssVar: "--spacing-icon-sm",
    label: "icon-sm",
    group: "icon",
    default: "1rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "icon-md",
    cssVar: "--spacing-icon-md",
    label: "icon-md",
    group: "icon",
    default: "1.25rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "icon-lg",
    cssVar: "--spacing-icon-lg",
    label: "icon-lg",
    group: "icon",
    default: "1.5rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "image-overlay-inset",
    cssVar: "--spacing-image-overlay-inset",
    label: "image-overlay-inset",
    group: "layout",
    default: "0.5rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "spacing-0",
    cssVar: "--spacing-0",
    label: "spacing-0",
    group: "layout",
    default: "0",
    step: 1,
    unit: "",
    readonly: true,
  },
  {
    id: "spacing-px",
    cssVar: "--spacing-px",
    label: "spacing-px",
    group: "layout",
    default: "1px",
    step: 1,
    unit: "px",
    readonly: true,
  },
  {
    id: "sidebar-w",
    cssVar: "--zd-sidebar-w",
    label: "sidebar-w",
    group: "layout",
    default: "clamp(14rem, 20vw, 22rem)",
    step: 1,
    unit: "",
    readonly: true,
  },
];

/**
 * Font tokens from `global.css` and the shared tokens.css it imports.
 *
 * Coverage: 16 tokens total.
 */
export const FONT_TOKENS: readonly TokenDef[] = [
  {
    id: "text-micro",
    cssVar: "--text-micro",
    label: "text-micro",
    group: "font-size",
    default: "0.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "text-caption",
    cssVar: "--text-caption",
    label: "text-caption",
    group: "font-size",
    default: "0.875rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "text-small",
    cssVar: "--text-small",
    label: "text-small",
    group: "font-size",
    default: "1rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "text-body",
    cssVar: "--text-body",
    label: "text-body",
    group: "font-size",
    default: "1.25rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "text-heading",
    cssVar: "--text-heading",
    label: "text-heading",
    group: "font-size",
    default: "1.75rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "text-display",
    cssVar: "--text-display",
    label: "text-display",
    group: "font-size",
    default: "2.5rem",
    step: 0.05,
    unit: "rem",
  },
  {
    id: "leading-tight",
    cssVar: "--leading-tight",
    label: "leading-tight",
    group: "line-height",
    default: "1.25",
    step: 0.05,
    unit: "",
  },
  {
    id: "leading-snug",
    cssVar: "--leading-snug",
    label: "leading-snug",
    group: "line-height",
    default: "1.375",
    step: 0.05,
    unit: "",
  },
  {
    id: "leading-normal",
    cssVar: "--leading-normal",
    label: "leading-normal",
    group: "line-height",
    default: "1.5",
    step: 0.05,
    unit: "",
  },
  {
    id: "leading-relaxed",
    cssVar: "--leading-relaxed",
    label: "leading-relaxed",
    group: "line-height",
    default: "1.75",
    step: 0.05,
    unit: "",
  },
  {
    id: "font-weight-normal",
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
    id: "font-weight-medium",
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
    id: "font-weight-semibold",
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
    id: "font-weight-bold",
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
    id: "font-sans",
    cssVar: "--font-sans",
    label: "font-sans",
    group: "font-family",
    default: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
    step: 1,
    unit: "",
    control: "text",
  },
  {
    id: "font-mono",
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
 * Size tokens (radius + transition) from `global.css` and the shared
 * tokens.css it imports.
 *
 * Coverage: 4 tokens total.
 * `radius-full` carries a pill toggle (sentinel 9999px).
 */
export const SIZE_TOKENS: readonly TokenDef[] = [
  {
    id: "radius-DEFAULT",
    cssVar: "--radius-DEFAULT",
    label: "radius-DEFAULT",
    group: "radius",
    default: "4px",
    step: 1,
    unit: "px",
  },
  {
    id: "radius-lg",
    cssVar: "--radius-lg",
    label: "radius-lg",
    group: "radius",
    default: "8px",
    step: 1,
    unit: "px",
  },
  {
    id: "radius-full",
    cssVar: "--radius-full",
    label: "radius-full",
    group: "radius",
    default: "9999px",
    step: 1,
    unit: "px",
    pill: { value: "9999px", customDefault: "16px" },
  },
  {
    id: "default-transition-duration",
    cssVar: "--default-transition-duration",
    label: "default-transition-duration",
    group: "transition",
    default: "150ms",
    step: 10,
    unit: "ms",
  },
];

/**
 * Color tokens — intentionally empty (v1). See file header.
 */
export const COLOR_TOKENS: readonly TokenDef[] = [];
