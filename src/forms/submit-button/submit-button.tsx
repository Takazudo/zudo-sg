import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type SubmitButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  class?: string;
  children?: ComponentChildren;
};

/** Accent-filled primary form action. Defaults to `type="submit"`. */
export function SubmitButton({ class: cls, type = "submit", children, ...rest }: SubmitButtonProps) {
  return (
    <button
      type={type}
      class={cx(
        "inline-flex items-center justify-center gap-x-hsp-xs",
        "rounded-md border border-accent bg-accent",
        "px-hsp-xl py-vsp-xs",
        "text-small font-semibold text-bg",
        "cursor-pointer transition-colors",
        "hover:border-accent-hover hover:bg-accent-hover",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        cls,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
