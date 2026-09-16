/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import type { Story, StoryMeta } from "@takazudo/zudo-sg/stories";
import Counter from "./counter.tsx";

const meta: StoryMeta = {
  title: "Counter",
  category: "Actions",
  description: "A `\"use client\"` island reached only through the registry virtual module — the foreign-install verify script's regression guard for finding 4's second half (ADR amendment 2026-09-16).",
  usage: `import Counter from "engine-host-ui/counter";\n\n<Counter start={3} />`,
};
export default meta;

export const Basic: Story = {
  name: "Basic",
  render: () => <Counter start={3} />,
};
