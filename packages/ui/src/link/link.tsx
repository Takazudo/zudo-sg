import type { ComponentChildren, JSX } from "preact";
import { cx } from "../lib/cx";

export type LinkVariant = "default" | "subtle" | "standalone";

export type LinkProps = {
  href: string;
  variant?: LinkVariant;
  /**
   * Mark as external. When true, adds rel="noopener noreferrer" + target="_blank"
   * (unless the caller overrides them) and renders an external glyph.
   */
  external?: boolean;
  class?: string;
  children?: ComponentChildren;
} & Omit<JSX.IntrinsicElements["a"], "class" | "href">;

const base =
  "rounded-sm outline-none transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const variants: Record<LinkVariant, string> = {
  // Inline body link: brand colored, underline on hover.
  default: "text-brand underline decoration-from-font underline-offset-2 hover:text-brand-strong",
  // Muted link that warms to brand on hover; no underline (use in dense nav/meta).
  subtle: "text-ink-soft no-underline hover:text-brand",
  // Block-level "call to action" link with arrow; no underline.
  standalone:
    "inline-flex items-center gap-hsp-2xs font-semibold text-brand no-underline hover:text-brand-strong",
};

/**
 * Anchor primitive with intent-named variants. `default` is the inline body
 * link; `subtle` suits nav/meta; `standalone` is a block CTA link with a
 * trailing arrow. Styled with semantic tokens, so dark-correct.
 */
export function Link(props: LinkProps) {
  const { href, variant = "default", external = false, class: cls, children, ...rest } = props;

  const externalAttrs = external
    ? { target: rest.target ?? "_blank", rel: rest.rel ?? "noopener noreferrer" }
    : {};

  return (
    <a href={href} class={cx(base, variants[variant], cls)} {...rest} {...externalAttrs}>
      {children}
      {variant === "standalone" && (
        <span aria-hidden="true" class="text-[0.9em]">
          →
        </span>
      )}
      {external && variant !== "standalone" && (
        <span aria-hidden="true" class="ml-hsp-2xs text-[0.85em] opacity-70">
          ↗
        </span>
      )}
    </a>
  );
}
