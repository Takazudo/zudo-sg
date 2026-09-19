/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";
import { Button } from "./button.tsx";

const meta: StoryMeta = {
  title: "Button",
  category: "Actions",
  description: "A component rendered through the styleguide engine.",
  usage: `import { Button } from "./ui/button/button";\n\n<Button>Primary action</Button>`,
};
export default meta;

export const Primary: Story = {
  name: "Primary",
  render: () => <Button>Primary action</Button>,
};

export const Plain: Story = {
  name: "Plain",
  render: () => <Button tone="plain">Plain action</Button>,
};
