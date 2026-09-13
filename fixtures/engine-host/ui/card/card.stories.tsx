/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";
import { Card } from "./card.tsx";

const meta: StoryMeta = {
  title: "Card",
  category: "Layout",
  description: "A second real component, proving the registry discovers more than one story file.",
  usage: `import { Card } from "engine-host-ui/card";\n\n<Card title="Example">Body</Card>`,
};
export default meta;

export const Basic: Story = {
  name: "Basic",
  render: () => <Card title="Example">Body content</Card>,
};
