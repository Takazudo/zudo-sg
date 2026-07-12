import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseH5Props = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["h5"],
  "class"
>;

/** MDX `h5` element override. */
export function ProseH5({ children, class: cls, ...rest }: ProseH5Props) {
  return (
    <h5 class={cx("text-caption font-semibold leading-snug text-muted", cls)} {...rest}>
      {children}
    </h5>
  );
}
