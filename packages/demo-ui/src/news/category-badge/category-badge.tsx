import type { JSX } from "preact";
import { cx } from "../../lib/cx";

type BadgeTone = "accent" | "neutral";

// Tone -> surface/border, derived via color-mix from the accent/neutral
// tokens (no raw hex) so both tones stay correct in light and dark.
const TONE_STYLE: Record<BadgeTone, JSX.CSSProperties> = {
  accent: {
    backgroundColor: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))",
    borderColor: "color-mix(in srgb, var(--color-accent) 35%, var(--color-bg))",
  },
  neutral: {
    backgroundColor: "var(--color-surface)",
    borderColor: "var(--color-border)",
  },
};

const TONE_TEXT_CLASS: Record<BadgeTone, string> = {
  accent: "text-accent",
  neutral: "text-muted",
};

/**
 * category -> tone. Unknown categories fall back to "neutral" rather than
 * being dropped — a category this map hasn't seen yet should still render.
 */
const CATEGORY_TONE: Record<string, BadgeTone> = {
  Corporate: "accent",
  IR: "accent",
  Products: "accent",
  Sustainability: "neutral",
  Exhibitions: "neutral",
};

export type CategoryBadgeProps = {
  category: string;
  class?: string;
};

/**
 * Small colored pill for a news item's category, shown next to its date in
 * NewsList. The design system has no per-category palette, only accent +
 * neutral tokens, so tone is derived by accent intensity (color-mix), not a
 * dedicated hue per category.
 */
export function CategoryBadge({ category, class: cls }: CategoryBadgeProps) {
  const tone = CATEGORY_TONE[category] ?? "neutral";
  return (
    <span
      class={cx(
        "inline-flex items-center whitespace-nowrap rounded border",
        "px-hsp-xs py-vsp-2xs",
        "text-micro font-semibold leading-none",
        TONE_TEXT_CLASS[tone],
        cls,
      )}
      style={TONE_STYLE[tone]}
    >
      {category}
    </span>
  );
}
