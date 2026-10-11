import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseBlockquoteProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["blockquote"],
  "class"
>;

/** MDX `blockquote` element override. */
export function ProseBlockquote({ children, class: cls, ...rest }: ProseBlockquoteProps) {
  return (
    <blockquote
      class={cx(
        "text-muted italic border-l-[3px] border-l-border pl-hsp-lg",
        "zc-prose-blockquote",
        cls,
      )}
      {...rest}
    >
      {children}
    </blockquote>
  );
}
