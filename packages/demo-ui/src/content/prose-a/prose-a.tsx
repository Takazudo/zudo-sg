import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseAProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["a"],
  "class"
>;

/**
 * MDX `a` element override. `class="hash-link"` marks a heading permalink
 * anchor (emitted by the heading auto-link plugin) — it renders unstyled so
 * it doesn't look like a body-copy link.
 */
export function ProseA({ children, class: cls, ...rest }: ProseAProps) {
  const isHashLink = typeof cls === "string" && cls.split(" ").includes("hash-link");

  if (isHashLink) {
    return (
      <a class={cls} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a class={cx("text-accent underline underline-offset-2 hover:text-accent-hover", cls)} {...rest}>
      {children}
    </a>
  );
}
