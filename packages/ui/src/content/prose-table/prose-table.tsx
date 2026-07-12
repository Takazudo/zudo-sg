import type { ComponentChildren, JSX } from "preact";
import { cx } from "../../lib/cx";

export type ProseTableProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["table"],
  "class"
>;
export type ProseThProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["th"],
  "class"
>;
export type ProseTdProps = { children?: ComponentChildren; class?: string } & Omit<
  JSX.IntrinsicElements["td"],
  "class"
>;

/** MDX `table` element override. */
export function ProseTable({ children, class: cls, ...rest }: ProseTableProps) {
  return (
    <table class={cx("w-full text-caption border-collapse", cls)} {...rest}>
      {children}
    </table>
  );
}

/** MDX `th` element override. */
export function ProseTh({ children, class: cls, style, ...rest }: ProseThProps) {
  return (
    <th
      class={cx("font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border", cls)}
      style={{ overflowWrap: "anywhere", ...(typeof style === "object" ? style : {}) }}
      {...rest}
    >
      {children}
    </th>
  );
}

/** MDX `td` element override. */
export function ProseTd({ children, class: cls, style, ...rest }: ProseTdProps) {
  return (
    <td
      class={cx("text-left py-vsp-xs px-hsp-md border-b border-b-border", cls)}
      style={{ overflowWrap: "anywhere", ...(typeof style === "object" ? style : {}) }}
      {...rest}
    >
      {children}
    </td>
  );
}
