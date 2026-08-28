import type { StoryMeta, Story } from "../../stories/types";
import { Stack, type StackProps } from "./stack";
import { stackDisplay } from "./stack.composer";

const meta: StoryMeta = {
  ...stackDisplay,
  usage: `import { Stack } from "@zudo-sg/ui/src/shared/stack/stack";

<Stack gap="md">
  <div>First</div>
  <div>Second</div>
</Stack>`,
};

export default meta;

const Filler = ({ label }: { label: string }) => (
  <div class="rounded-md border border-border bg-surface px-hsp-md py-vsp-sm text-small text-fg">
    {label}
  </div>
);

export const Default: Story<StackProps> = {
  name: "Default (vertical, gap=md)",
  source: `<Stack>
  <div>First</div>
  <div>Second</div>
  <div>Third</div>
</Stack>`,
  render: () => (
    <Stack>
      <Filler label="First" />
      <Filler label="Second" />
      <Filler label="Third" />
    </Stack>
  ),
};

export const Horizontal: Story<StackProps> = {
  name: "Horizontal (wraps instead of overflowing)",
  source: `<Stack direction="horizontal" gap="sm">
  <div>A</div>
  <div>B</div>
  <div>C</div>
</Stack>`,
  render: () => (
    <Stack direction="horizontal" gap="sm">
      <Filler label="A" />
      <Filler label="B" />
      <Filler label="C" />
    </Stack>
  ),
};

export const Narrow: Story<StackProps> = {
  name: "Narrow (horizontal wraps without overflow)",
  source: `<div style={{ maxWidth: "220px" }}>
  <Stack direction="horizontal" gap="sm">
    <div>Alpha</div>
    <div>Bravo</div>
    <div>Charlie</div>
  </Stack>
</div>`,
  render: () => (
    <div style={{ maxWidth: "220px" }}>
      <Stack direction="horizontal" gap="sm">
        <Filler label="Alpha" />
        <Filler label="Bravo" />
        <Filler label="Charlie" />
      </Stack>
    </div>
  ),
};
