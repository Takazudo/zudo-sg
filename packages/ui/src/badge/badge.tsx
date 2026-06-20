import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "accent";
export type BadgeVariant = "soft" | "solid" | "outline";

export type BadgeProps = {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  class?: string;
  children: ComponentChildren;
};

const base =
  "inline-flex items-center gap-hsp-2xs rounded-full px-hsp-sm py-vsp-3xs " +
  "text-xs font-semibold leading-none whitespace-nowrap";

// Soft = tinted background + colored text. The neutral soft tint reuses the
// sunken surface since there is no dedicated neutral tint token.
const soft: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-strong",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  accent: "bg-surface-sunken text-accent",
};

const solid: Record<BadgeTone, string> = {
  neutral: "bg-ink text-paper",
  brand: "bg-brand text-on-brand",
  success: "bg-success text-on-brand",
  danger: "bg-danger text-on-brand",
  accent: "bg-accent text-ink",
};

const outline: Record<BadgeTone, string> = {
  neutral: "border border-line text-ink-soft",
  brand: "border border-brand text-brand",
  success: "border border-success text-success",
  danger: "border border-danger text-danger",
  accent: "border border-accent text-accent",
};

const byVariant: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft,
  solid,
  outline,
};

/**
 * Compact status / label pill. Five tones × three fills, all token-driven so
 * each tone reads correctly in light and dark.
 */
export function Badge({ tone = "neutral", variant = "soft", class: cls, children }: BadgeProps) {
  return <span class={cx(base, byVariant[variant][tone], cls)}>{children}</span>;
}
