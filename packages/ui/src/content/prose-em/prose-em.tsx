import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseEmProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["em"],
  "class"
>;

/** MDX `em` element override. */
export function ProseEm({ children, class: cls, ...rest }: ProseEmProps) {
  return (
    <em class={cx("italic", cls)} {...rest}>
      {children}
    </em>
  );
}
