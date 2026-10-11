import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseLiProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["li"],
  "class"
>;

/** MDX `li` element override. */
export function ProseLi({ children, class: cls, ...rest }: ProseLiProps) {
  return (
    <li
      class={cx(
        "marker:text-muted mb-vsp-xs zc-prose-li",
        cls,
      )}
      {...rest}
    >
      {children}
    </li>
  );
}
