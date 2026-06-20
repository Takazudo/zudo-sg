import type { ComponentChildren, JSX } from "preact";
import { cx } from "../lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the inline axis of its container. */
  block?: boolean;
  class?: string;
  children?: ComponentChildren;
};

/** Render as a real <button> (default) or, when `href` is set, an <a>. */
export type ButtonProps =
  | (BaseProps & { href: string } & Omit<JSX.IntrinsicElements["a"], "class" | "size">)
  | (BaseProps & { href?: undefined } & Omit<JSX.IntrinsicElements["button"], "class" | "size">);

const base =
  "inline-flex items-center justify-center gap-hsp-xs rounded-md font-semibold " +
  "no-underline whitespace-nowrap cursor-pointer select-none " +
  "transition-colors outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50";

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-hsp-md py-vsp-3xs",
  md: "text-sm px-hsp-lg py-vsp-2xs",
  lg: "text-base px-hsp-xl py-vsp-xs",
};

const variants: Record<ButtonVariant, string> = {
  // Filled brand. On-brand text in both schemes.
  primary: "bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong",
  // Outlined neutral that warms to brand on hover.
  secondary:
    "bg-surface text-ink border border-line " +
    "hover:border-brand hover:text-brand active:bg-surface-sunken",
  // Text-only; subtle hover wash.
  ghost: "bg-transparent text-ink-soft hover:bg-surface-sunken hover:text-ink active:bg-surface-sunken",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, block: boolean, extra?: string) {
  return cx(base, sizes[size], variants[variant], block && "w-full", extra);
}

/**
 * Primary action control. Renders a semantic <button> by default, or an <a>
 * when `href` is provided (so the same visual variants serve links and
 * buttons). Styled entirely with semantic color + tight-spacing tokens, so it
 * is dark-correct via the token system.
 */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", block = false, class: cls, children, ...rest } = props;
  const className = classesFor(variant, size, block, cls);

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as JSX.IntrinsicElements["a"] & { href: string };
    return (
      <a href={href} class={className} {...anchorRest}>
        {children}
      </a>
    );
  }

  const { type, ...buttonRest } = rest as JSX.IntrinsicElements["button"];
  return (
    <button type={type ?? "button"} class={className} {...buttonRest}>
      {children}
    </button>
  );
}
