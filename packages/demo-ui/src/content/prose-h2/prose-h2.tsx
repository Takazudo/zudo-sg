import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseH2Props = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["h2"],
  "class"
>;

/** MDX `h2` element override. */
export function ProseH2({ children, class: cls, ...rest }: ProseH2Props) {
  return (
    <h2
      class={cx("text-title font-bold leading-tight text-fg pb-vsp-2xs border-b-2 border-b-border", cls)}
      {...rest}
    >
      {children}
    </h2>
  );
}
