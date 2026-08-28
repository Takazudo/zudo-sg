import { defineComponent } from "@zudo-composer/component-contract";
import { ProseP, type ProsePProps } from "./prose-p";

export const prosePDisplay = {
  title: "ProseP",
  category: "Typography",
  description:
    "MDX `p` element override — plain paragraph; flow spacing is owned by the consumer's content-flow stylesheet.",
} as const;

export const prosePComposer = defineComponent<ProsePProps, typeof ProseP, unknown, HTMLElement>({
  id: "ui.prose-p",
  schemaVersion: 1,
  ...prosePDisplay,
  source: { module: "@zudo-sg/ui", exportKind: "named", exportName: "ProseP" },
  defaults: { children: "Body copy." },
  fields: [
    { kind: "text", prop: "children", label: "Text", inlineEdit: { multiline: true } },
  ],
  component: ProseP,
  adapters: { inlineEditor: { field: "children", resolveElement: (root) => root } },
});
