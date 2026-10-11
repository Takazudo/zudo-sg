import type { Child } from "@takazudo/zfb/zudo-react";
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";
import { Card } from "./card.tsx";

const meta: StoryMeta = {
  title: "Card",
  category: "Layout",
  description: "A second real component, proving the registry discovers more than one story file.",
  usage: `import { Card } from "./ui/card/card";\n\n<Card title="Example">Body</Card>`,
};
export default meta;

export const Basic: Story = {
  name: "Basic",
  render: (): Child => <Card title="Example">Body content</Card>,
};
