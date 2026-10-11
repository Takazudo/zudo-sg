import type { Child } from "@takazudo/zfb/zudo-react";
import type { JSX } from "@takazudo/zfb/zudo-react/jsx-runtime";

export function Card(props: { title: string; children: Child }): JSX.Element {
  return (
    <div data-ui-card class="zc-fixture-card border border-border rounded-md p-hsp-md">
      <h3 class="font-bold mb-vsp-sm">{props.title}</h3>
      {props.children}
    </div>
  );
}
