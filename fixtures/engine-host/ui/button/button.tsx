/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";

export function Button(props: { children: ComponentChildren; tone?: "accent" | "plain" }): JSX.Element {
  const tone = props.tone ?? "accent";
  return (
    <button
      type="button"
      data-ui-button={tone}
      class={tone === "accent" ? "bg-accent text-bg px-hsp-md py-vsp-sm" : "text-fg px-hsp-md"}
    >
      {props.children}
    </button>
  );
}
