import type { JSX } from "preact";
import { cx } from "../../lib/cx";
import { CONTROL_BASE } from "../lib/control-style";

export type TextareaProps = JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  class?: string;
};

/** Multi-line text input (e.g. an inquiry message). Vertical resize only. */
export function Textarea({ class: cls, rows = 6, ...rest }: TextareaProps) {
  return <textarea rows={rows} class={cx(CONTROL_BASE, "resize-y", cls)} {...rest} />;
}
