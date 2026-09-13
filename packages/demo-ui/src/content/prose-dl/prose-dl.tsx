import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseDlProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["dl"],
  "class"
>;
export type ProseDtProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["dt"],
  "class"
>;
export type ProseDdProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["dd"],
  "class"
>;

/** MDX `dl` element override. */
export function ProseDl({ children, ...rest }: ProseDlProps) {
  return <dl {...rest}>{children}</dl>;
}

/** MDX `dt` element override. */
export function ProseDt({ children, class: cls, ...rest }: ProseDtProps) {
  return (
    <dt class={cx("font-semibold text-fg mt-vsp-md", cls)} {...rest}>
      {children}
    </dt>
  );
}

/** MDX `dd` element override. */
export function ProseDd({ children, class: cls, ...rest }: ProseDdProps) {
  return (
    <dd class={cx("text-muted mb-vsp-xs pl-hsp-xl", cls)} {...rest}>
      {children}
    </dd>
  );
}
