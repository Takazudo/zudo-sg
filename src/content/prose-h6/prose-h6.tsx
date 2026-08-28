import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseH6Props = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["h6"],
  "class"
>;

/** MDX `h6` element override. */
export function ProseH6({ children, class: cls, ...rest }: ProseH6Props) {
  return (
    <h6 class={cx("text-caption font-semibold leading-snug text-muted", cls)} {...rest}>
      {children}
    </h6>
  );
}
