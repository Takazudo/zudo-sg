import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

export function Button(props: { children: Child; tone?: "accent" | "plain" }): JSX.Element {
  const tone = props.tone ?? "accent";
  return (
    <button
      type="button"
      data-ui-button={tone}
      class={tone === "accent" ? "bg-accent text-bg px-hsp-md py-vsp-sm rounded-full" : "text-fg px-hsp-md rounded-full"}
    >
      {props.children}
    </button>
  );
}
