import type { ComponentChildren } from "preact";
import { cx } from "../lib/cx";

export type CardVariant = "outlined" | "elevated" | "filled";

type CardProps = {
  variant?: CardVariant;
  /** When set, the whole card becomes a link and lifts on hover. */
  href?: string;
  class?: string;
  children: ComponentChildren;
};

const base = "flex flex-col gap-vsp-xs rounded-lg p-hsp-xl transition-shadow transition-colors";

const variants: Record<CardVariant, string> = {
  outlined: "bg-surface border border-line",
  elevated: "bg-surface shadow-card",
  filled: "bg-surface-sunken",
};

const interactive =
  "no-underline cursor-pointer outline-none " +
  "hover:shadow-raised hover:border-line-strong " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Surface container. Three elevation variants; becomes a clickable, lifting
 * card when `href` is set. Padding + internal gap use tight tokens.
 */
export function Card({ variant = "outlined", href, class: cls, children }: CardProps) {
  const className = cx(base, variants[variant], href && interactive, cls);
  if (href) {
    return (
      <a href={href} class={className}>
        {children}
      </a>
    );
  }
  return <div class={className}>{children}</div>;
}

type CardSlotProps = { class?: string; children: ComponentChildren };

/** Title row inside a Card. Renders an <h3> by default. */
export function CardTitle({ class: cls, children }: CardSlotProps) {
  return <h3 class={cx("text-lg font-semibold tracking-tight text-ink", cls)}>{children}</h3>;
}

/** Body copy inside a Card. */
export function CardBody({ class: cls, children }: CardSlotProps) {
  return <p class={cx("text-sm text-ink-soft text-pretty", cls)}>{children}</p>;
}

/** Footer row inside a Card (actions / meta), separated by a top hairline. */
export function CardFooter({ class: cls, children }: CardSlotProps) {
  return (
    <div class={cx("mt-vsp-2xs flex items-center gap-hsp-md border-t border-line pt-vsp-xs", cls)}>
      {children}
    </div>
  );
}
