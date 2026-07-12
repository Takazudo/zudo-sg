import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { SplitLayout, type SplitLayoutProps } from "./split-layout";

const meta: StoryMeta = {
  title: "SplitLayout",
  category: "Layout",
  description:
    "Two-pane layout: stacked full-width panes below md, ratio-controlled side-by-side panes at md and above.",
  usage: `import { SplitLayout } from "@zudo-sg/ui/src/shared/split-layout/split-layout";

<SplitLayout
  ratio="60/40"
  left={<div>Left pane</div>}
  right={<div>Right pane</div>}
/>`,
  composer: defineComposer<SplitLayoutProps>({
    componentId: "ui.split-layout",
    version: 1,
    component: SplitLayout,
    source: {
      module: "@zudo-sg/ui/src/shared/split-layout/split-layout",
      exportKind: "named",
      exportName: "SplitLayout",
    },
    defaults: { ratio: "50/50", gap: "md" },
    fields: [
      {
        kind: "select",
        prop: "ratio",
        label: "Ratio",
        options: ["50/50", "40/60", "60/40", "33/67", "67/33"],
      },
      { kind: "select", prop: "gap", label: "Gap", options: ["sm", "md", "lg"] },
    ],
    // One left slot (single) + an ordered, many right slot — proves #242's
    // named right-column use case (multiple children, one named prop each).
    slots: [
      { id: "left", prop: "left", label: "Left", cardinality: "single" },
      { id: "right", prop: "right", label: "Right", cardinality: "many" },
    ],
  }),
};

export default meta;

const Pane = ({ label }: { label: string }) => (
  <div class="rounded-md border border-border bg-surface px-hsp-lg py-vsp-md text-small text-fg">
    {label}
  </div>
);

export const Default: Story<SplitLayoutProps> = {
  name: "Default (50/50)",
  source: `<SplitLayout left={<div>Left pane</div>} right={<div>Right pane</div>} />`,
  render: () => (
    <SplitLayout left={<Pane label="Left pane" />} right={<Pane label="Right pane" />} />
  ),
};

export const OrderedRightChildren: Story<SplitLayoutProps> = {
  name: "Multiple ordered right-slot children (60/40)",
  source: `<SplitLayout
  ratio="60/40"
  left={<div>Left pane</div>}
  right={
    <>
      <div>Right — first</div>
      <div>Right — second</div>
    </>
  }
/>`,
  render: () => (
    <SplitLayout
      ratio="60/40"
      left={<Pane label="Left pane" />}
      right={
        <div class="flex flex-col gap-y-vsp-sm">
          <Pane label="Right — first" />
          <Pane label="Right — second" />
        </div>
      }
    />
  ),
};

export const Narrow: Story<SplitLayoutProps> = {
  name: "Narrow (stacked below md)",
  source: `<div style={{ maxWidth: "320px" }}>
  <SplitLayout left={<div>Left pane</div>} right={<div>Right pane</div>} />
</div>`,
  render: () => (
    <div style={{ maxWidth: "320px" }}>
      <SplitLayout left={<Pane label="Left pane" />} right={<Pane label="Right pane" />} />
    </div>
  ),
};
