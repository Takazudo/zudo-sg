/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";

export function Card(props: { title: string; children: ComponentChildren }): JSX.Element {
  return (
    <div data-ui-card class="border border-fg/20 rounded-md p-hsp-md">
      <h3 class="font-bold mb-vsp-sm">{props.title}</h3>
      {props.children}
    </div>
  );
}
