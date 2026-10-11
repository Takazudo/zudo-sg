import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseOlProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["ol"],
  "class"
>;

/** MDX `ol` element override. */
export function ProseOl({ children, class: cls, ...rest }: ProseOlProps) {
  return (
    <ol class={cx("list-decimal pl-hsp-xl", cls)} {...rest}>
      {children}
    </ol>
  );
}
