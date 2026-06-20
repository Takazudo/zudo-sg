import type { StoryMeta, Story } from "../stories/types";
import { Stat, StatGroup } from "./stat";

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

export const Single: Story = {
  name: "Single",
  render: () => <Stat value="99.9%" label="Uptime" hint="last 90 days" />,
};

export const Group: Story = {
  name: "Group",
  render: () => (
    <StatGroup>
      <Stat value="99.9%" label="Uptime" />
      <Stat value="1.2M" label="Requests / day" />
      <Stat value="42ms" label="p95 latency" />
      <Stat value="12k" label="Active users" />
    </StatGroup>
  ),
};

export const Divided: Story = {
  name: "Divided",
  render: () => (
    <StatGroup divided>
      <Stat value="99.9%" label="Uptime" />
      <Stat value="1.2M" label="Requests / day" />
      <Stat value="42ms" label="p95 latency" />
      <Stat value="12k" label="Active users" />
    </StatGroup>
  ),
};
