import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type SecondaryButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  class?: string;
  children?: ComponentChildren;
};

/**
 * Secondary form action (e.g. "Back to edit", "Start another entry") —
 * SubmitButton's outlined sibling. Defaults to `type="button"`.
 */
export function SecondaryButton({
  class: cls,
  type = "button",
  children,
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      class={cx(
        "inline-flex cursor-pointer items-center justify-center",
        "rounded-md border border-border bg-bg",
        "px-hsp-lg py-vsp-xs",
        "text-small font-medium text-fg",
        "transition-colors",
        "hover:border-accent hover:text-accent",
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
