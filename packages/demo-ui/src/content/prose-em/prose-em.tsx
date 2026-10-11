import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseEmProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["em"],
  "class"
>;

/** MDX `em` element override. */
export function ProseEm({ children, class: cls, ...rest }: ProseEmProps) {
  return (
    <em class={cx("italic", cls)} {...rest}>
      {children}
    </em>
  );
}
