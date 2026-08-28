import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseBlockquoteProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["blockquote"],
  "class"
>;

/** MDX `blockquote` element override. */
export function ProseBlockquote({ children, class: cls, ...rest }: ProseBlockquoteProps) {
  return (
    <blockquote
      class={cx(
        "text-muted italic border-l-[3px] border-l-border pl-hsp-lg",
        "[&_p]:mb-vsp-xs",
        cls,
      )}
      {...rest}
    >
      {children}
    </blockquote>
  );
}
