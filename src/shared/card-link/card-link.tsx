import type { ComponentChildren } from "preact";
import { cx } from "../../lib/cx";
import { externalLinkAttrs } from "../external-link/external-link";

export type CardLinkProps = {
  href: string;
  /** Adds target="_blank" + rel="noopener noreferrer". */
  external?: boolean;
  "aria-label"?: string;
  class?: string;
  children?: ComponentChildren;
};

/**
 * Wraps a block (typically a Card) in a full-bleed link so the whole card
 * becomes clickable. Color/underline are pinned inline as a second guard
 * against `.zd-content`'s unlayered `a { color; text-decoration }` winning
 * when this renders inside MDX body copy. Adds a `.group` class so children
 * can react to hover via `group-hover:*`.
 */
export function CardLink({ href, external, class: cls, children, ...rest }: CardLinkProps) {
  return (
    <a
      href={href}
      {...externalLinkAttrs(external)}
      {...rest}
      class={cx("group block h-full no-underline", cls)}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {children}
    </a>
  );
}

export type ViewAllLinkProps = {
  href: string;
  class?: string;
  children?: ComponentChildren;
};

/** Accent-colored "view all" inline link with a trailing arrow. */
export function ViewAllLink({ href, class: cls, children }: ViewAllLinkProps) {
  return (
    <a
      href={href}
      class={cx(
        "group inline-flex items-center gap-x-hsp-2xs text-caption font-semibold",
        "text-accent no-underline transition-colors hover:text-accent-hover",
        cls,
      )}
    >
      {children}
      <span aria-hidden="true">→</span>
    </a>
  );
}
