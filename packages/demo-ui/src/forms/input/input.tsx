import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";
import { cx } from "../../lib/cx";
import { CONTROL_BASE } from "../lib/control-style";

export type InputProps = JSX.IntrinsicElements["input"] & {
  class?: string;
};

/** Single-line text input (type="text" / "email" / "tel" / ...). Pairs with `<Field>`. */
export function Input(props: InputProps) {
  // Preserve the intrinsic input union while forwarding its correlated
  // type/value/model props and supplying the same static default type.
  const forwarded = {
    ...props,
    type: props.type ?? "text",
    class: cx(CONTROL_BASE, props.class),
  } as JSX.IntrinsicElements["input"];
  return <input {...forwarded} />;
}
