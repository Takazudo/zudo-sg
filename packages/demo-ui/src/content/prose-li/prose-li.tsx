import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseLiProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["li"],
  "class"
>;

/** MDX `li` element override. */
export function ProseLi({ children, class: cls, ...rest }: ProseLiProps) {
  return (
    <li
      class={cx(
        "marker:text-muted mb-vsp-xs",
        "[&>ul]:mt-vsp-xs [&>ul]:mb-0 [&>ol]:mt-vsp-xs [&>ol]:mb-0",
        cls,
      )}
      {...rest}
    >
      {children}
    </li>
  );
}
