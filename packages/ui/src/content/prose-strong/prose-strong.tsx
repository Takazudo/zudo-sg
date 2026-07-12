import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseStrongProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["strong"],
  "class"
>;

/** MDX `strong` element override. */
export function ProseStrong({ children, class: cls, ...rest }: ProseStrongProps) {
  return (
    <strong class={cx("font-bold text-fg", cls)} {...rest}>
      {children}
    </strong>
  );
}
