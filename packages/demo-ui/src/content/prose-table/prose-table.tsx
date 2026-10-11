import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";

export type ProseTableProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["table"],
  "class"
>;
export type ProseThProps = { children?: Child; class?: string; style?: JSX.CSSProperties } & Omit<
  JSX.IntrinsicElements["th"],
  "class" | "style"
>;
export type ProseTdProps = { children?: Child; class?: string; style?: JSX.CSSProperties } & Omit<
  JSX.IntrinsicElements["td"],
  "class" | "style"
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
      style={{ "overflow-wrap": "anywhere", ...style }}
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
      style={{ "overflow-wrap": "anywhere", ...style }}
      {...rest}
    >
      {children}
    </td>
  );
}
