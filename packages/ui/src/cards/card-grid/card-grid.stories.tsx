import type { StoryMeta, Story } from "../../stories/types";
import { CardGrid, type CardGridProps } from "./card-grid";
import { Card } from "../card/card";

const meta: StoryMeta = {
  title: "CardGrid",
  category: "Data Display",
  description: "Responsive auto-fit grid wrapper for a run of Cards in a content body.",
  usage: `import { CardGrid } from "@zudo-sg/ui/src/cards/card-grid/card-grid";
import { Card } from "@zudo-sg/ui/src/cards/card/card";

<CardGrid>
  <Card title="One">…</Card>
  <Card title="Two">…</Card>
</CardGrid>`,
};

export default meta;

export const Default: Story<CardGridProps> = {
  name: "Default",
  source: `<CardGrid>
  <Card title="Product A">…</Card>
  <Card title="Product B" variant="muted">…</Card>
  <Card title="Product C" variant="accent">…</Card>
  <Card title="Product D">…</Card>
</CardGrid>`,
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <CardGrid>
        <Card title="Product A">Description text.</Card>
        <Card title="Product B" variant="muted">
          Description text.
        </Card>
        <Card title="Product C" variant="accent">
          Description text.
        </Card>
        <Card title="Product D">Description text.</Card>
      </CardGrid>
    </div>
  ),
};
