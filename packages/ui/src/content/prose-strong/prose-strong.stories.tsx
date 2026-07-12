import type { StoryMeta, Story } from "../../stories/types";
import { ProseStrong, type ProseStrongProps } from "./prose-strong";

const meta: StoryMeta = {
  title: "ProseStrong",
  category: "Typography",
  description: "MDX `strong` element override — bold inline emphasis.",
  usage: `import { ProseStrong } from "@zudo-sg/ui/src/content/prose-strong/prose-strong";

<ProseStrong>important text</ProseStrong>`,
};

export default meta;

export const Default: Story<ProseStrongProps> = {
  name: "Default",
  source: `<ProseStrong>important text</ProseStrong>`,
  render: () => <ProseStrong>important text</ProseStrong>,
};
