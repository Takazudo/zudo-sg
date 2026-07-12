import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseUlProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["ul"],
  "class"
>;

/** MDX `ul` element override. */
export function ProseUl({ children, class: cls, ...rest }: ProseUlProps) {
  return (
    <ul class={cx("list-disc pl-hsp-xl", cls)} {...rest}>
      {children}
    </ul>
  );
}
