/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";
import Counter from "./counter.tsx";

const meta: StoryMeta = {
  title: "Counter",
  category: "Actions",
  description: "A `\"use client\"` island reached through the generated registry.",
  usage: `import Counter from "./ui/counter/counter";\n\n<Counter start={3} />`,
};
export default meta;

export const Basic: Story = {
  name: "Basic",
  render: () => <Counter start={3} />,
};
