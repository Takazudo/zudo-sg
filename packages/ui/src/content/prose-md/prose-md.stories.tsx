import type { StoryMeta, Story } from "../../stories/types";
import { ProseMd, type ProseMdProps } from "./prose-md";
import { proseMdDisplay, SAMPLE_MARKDOWN } from "./prose-md.composer";

const meta: StoryMeta = {
  ...proseMdDisplay,
  usage: `import { ProseMd } from "@zudo-sg/ui/src/content/prose-md/prose-md";

<ProseMd markdown={"## Heading\\n\\nBody copy."} />`,
};

export default meta;

export const Default: Story<ProseMdProps> = {
  name: "Default",
  source: `<ProseMd markdown={${JSON.stringify(SAMPLE_MARKDOWN)}} />`,
  render: () => <ProseMd markdown={SAMPLE_MARKDOWN} />,
};
