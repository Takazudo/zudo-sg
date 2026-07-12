import type { JSX } from "preact";
import { cx } from "../../lib/cx";
import { CONTROL_BASE } from "../lib/control-style";

export type InputProps = JSX.InputHTMLAttributes<HTMLInputElement> & {
  class?: string;
};

/** Single-line text input (type="text" / "email" / "tel" / ...). Pairs with `<Field>`. */
export function Input({ class: cls, type = "text", ...rest }: InputProps) {
  return <input type={type} class={cx(CONTROL_BASE, cls)} {...rest} />;
}
