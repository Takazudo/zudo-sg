import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseH3Props = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["h3"],
  "class"
>;

/** MDX `h3` element override. */
export function ProseH3({ children, class: cls, ...rest }: ProseH3Props) {
  return (
    <h3
      class={cx("text-title font-semibold leading-snug text-fg pl-hsp-sm border-l-[3px] border-l-accent", cls)}
      {...rest}
    >
      {children}
    </h3>
  );
}
