import type { StoryMeta, Story } from "../../stories/types";
import { AutoGrid, type AutoGridProps } from "./auto-grid";
import { Card } from "../../cards/card/card";

const meta: StoryMeta = {
  title: "AutoGrid",
  category: "Layout",
  description:
    "Auto-fit/auto-fill responsive grid primitive for card-style listings, switching column density by minimum track width.",
  usage: `import { AutoGrid } from "@zudo-sg/ui/src/shared/auto-grid/auto-grid";

<AutoGrid min="15rem">
  <Card title="One">…</Card>
  <Card title="Two">…</Card>
</AutoGrid>`,
};

export default meta;

const items = ["A", "B", "C", "D", "E", "F"];

export const Default: Story<AutoGridProps> = {
  name: "Default (auto-fit, min 15rem)",
  source: `<AutoGrid>
  <Card title="Item A">…</Card>
  …
</AutoGrid>`,
  render: () => (
    <AutoGrid>
      {items.map((x) => (
        <Card key={x} title={`Item ${x}`}>
          Sample card laid out by AutoGrid.
        </Card>
      ))}
    </AutoGrid>
  ),
};

export const WiderTracks: Story<AutoGridProps> = {
  name: "Wider tracks (min 16rem)",
  source: `<AutoGrid min="16rem">…</AutoGrid>`,
  render: () => (
    <AutoGrid min="16rem">
      {items.map((x) => (
        <Card key={x} title={`Item ${x}`}>
          Sample.
        </Card>
      ))}
    </AutoGrid>
  ),
};

export const Fill: Story<AutoGridProps> = {
  name: "Fill (keeps empty tracks)",
  source: `<AutoGrid min="13rem" fill>…</AutoGrid>`,
  render: () => (
    <AutoGrid min="13rem" fill>
      {items.map((x) => (
        <Card key={x} title={`Location ${x}`}>
          Sample.
        </Card>
      ))}
    </AutoGrid>
  ),
};
