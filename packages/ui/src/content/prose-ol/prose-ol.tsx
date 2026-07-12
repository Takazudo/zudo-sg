import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseOlProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["ol"],
  "class"
>;

/** MDX `ol` element override. */
export function ProseOl({ children, class: cls, ...rest }: ProseOlProps) {
  return (
    <ol class={cx("list-decimal pl-hsp-xl", cls)} {...rest}>
      {children}
    </ol>
  );
}
