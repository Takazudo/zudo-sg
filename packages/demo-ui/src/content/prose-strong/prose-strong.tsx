import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseStrongProps = { children?: Child; class?: string } & Omit<
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
