import type { StoryMeta, Story } from "../stories/types";
import { Stat, StatGroup } from "./stat";

// Neither Props type is exported; derive them from the components themselves.
type StatProps = Parameters<typeof Stat>[0];
type StatGroupProps = Parameters<typeof StatGroup>[0];

const meta: StoryMeta = {
  title: "Stat",
  category: "Data Display",
  description: "A metric value over a muted label, and a StatGroup that lays several out as a <dl>.",
  usage: `import { Stat, StatGroup } from "@zudo-sg/ui";

<StatGroup>
  <Stat value="99.9%" label="Uptime" />
  <Stat value="1.2M" label="Requests / day" />
</StatGroup>`,
  order: 2,
};

export default meta;

export const Playground: Story<StatProps> = {
  name: "Playground",
  source: `<Stat value={42} label="Active users" hint="last 30 days" />`,
  controls: [
    {
      type: "number",
      prop: "value",
      label: "Value",
      defaultValue: 42,
      min: 0,
      max: 100,
      step: 1,
      ui: "range",
    },
    {
      type: "text",
      prop: "label",
      label: "Label",
      defaultValue: "Active users",
    },
    {
      type: "text",
      prop: "hint",
      label: "Hint",
      defaultValue: "last 30 days",
    },
  ],
  render: (args = {}) => <Stat value={args.value} label={args.label} hint={args.hint} />,
};

export const Single: Story<StatProps> = {
  name: "Single",
  source: `<Stat value="99.9%" label="Uptime" hint="last 90 days" />`,
  render: () => <Stat value="99.9%" label="Uptime" hint="last 90 days" />,
};

export const Group: Story<StatGroupProps> = {
  name: "Group",
  source: `<StatGroup>
  <Stat value="99.9%" label="Uptime" />
  <Stat value="1.2M" label="Requests / day" />
  <Stat value="42ms" label="p95 latency" />
  <Stat value="12k" label="Active users" />
</StatGroup>`,
  render: () => (
    <StatGroup>
      <Stat value="99.9%" label="Uptime" />
      <Stat value="1.2M" label="Requests / day" />
      <Stat value="42ms" label="p95 latency" />
      <Stat value="12k" label="Active users" />
    </StatGroup>
  ),
};

export const Divided: Story<StatGroupProps> = {
  name: "Divided",
  source: `<StatGroup divided>
  <Stat value="99.9%" label="Uptime" />
  <Stat value="1.2M" label="Requests / day" />
  <Stat value="42ms" label="p95 latency" />
  <Stat value="12k" label="Active users" />
</StatGroup>`,
  render: () => (
    <StatGroup divided>
      <Stat value="99.9%" label="Uptime" />
      <Stat value="1.2M" label="Requests / day" />
      <Stat value="42ms" label="p95 latency" />
      <Stat value="12k" label="Active users" />
    </StatGroup>
  ),
};
