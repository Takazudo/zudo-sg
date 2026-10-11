import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseUlProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["ul"],
  "class"
>;

/** MDX `ul` element override. */
export function ProseUl({ children, class: cls, ...rest }: ProseUlProps) {
  return (
    <ul class={cx("list-disc pl-hsp-xl", cls)} {...rest}>
      {children}
    </ul>
  );
}
