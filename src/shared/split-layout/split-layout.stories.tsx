import type { StoryMeta, Story } from "../../stories/types";
import { SplitLayout, type SplitLayoutProps } from "./split-layout";
import { splitLayoutDisplay } from "./split-layout.composer";

const meta: StoryMeta = {
  ...splitLayoutDisplay,
  usage: `import { SplitLayout } from "@zudo-sg/ui/src/shared/split-layout/split-layout";

<SplitLayout
  ratio="60/40"
  left={<div>Left pane</div>}
  right={<div>Right pane</div>}
/>`,
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
