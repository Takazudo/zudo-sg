import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

export type ProsePProps = { children?: Child; class?: string } & Omit<
  JSX.IntrinsicElements["p"],
  "class"
>;

/** MDX `p` element override. No appearance of its own — flow spacing is owned by the consumer's content-flow stylesheet. */
export function ProseP({ children, ...rest }: ProsePProps) {
  return <p {...rest}>{children}</p>;
}
