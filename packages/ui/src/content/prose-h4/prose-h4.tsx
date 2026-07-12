import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseH4Props = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["h4"],
  "class"
>;

/** MDX `h4` element override. */
export function ProseH4({ children, class: cls, ...rest }: ProseH4Props) {
  return (
    <h4 class={cx("text-small font-semibold leading-snug text-fg", cls)} {...rest}>
      {children}
    </h4>
  );
}
