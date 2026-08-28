import { defineComponent } from "@zudo-composer/component-contract";
import { Stack, type StackProps } from "./stack";

export const stackDisplay = {
  title: "Stack",
  category: "Layout",
  description:
    "Generic flex stack — vertical or horizontal — with bounded gap, cross-axis alignment, and main-axis justification. Horizontal stacks always wrap so they never force overflow.",
} as const;

export const stackComposer = defineComponent<StackProps, typeof Stack>({
  id: "ui.stack",
  schemaVersion: 1,
  ...stackDisplay,
  source: { module: "@zudo-sg/ui", exportKind: "named", exportName: "Stack" },
  defaults: { direction: "vertical", gap: "md", align: "stretch", justify: "start" },
  fields: [
    {
      kind: "select",
      prop: "direction",
      label: "Direction",
      options: ["vertical", "horizontal"],
    },
    { kind: "select", prop: "gap", label: "Gap", options: ["xs", "sm", "md", "lg", "xl"] },
    {
      kind: "select",
      prop: "align",
      label: "Align",
      options: ["start", "center", "end", "stretch"],
    },
    {
      kind: "select",
      prop: "justify",
      label: "Justify",
      options: ["start", "center", "end", "between"],
    },
  ],
  slots: [{ id: "content", prop: "children", label: "Content", cardinality: "many" }],
  component: Stack,
});
