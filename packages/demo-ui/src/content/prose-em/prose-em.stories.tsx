import type { StoryMeta, Story } from "../../stories/types";
import { ProseEm, type ProseEmProps } from "./prose-em";

const meta: StoryMeta = {
  title: "ProseEm",
  category: "Typography",
  description: "MDX `em` element override — italic inline emphasis.",
  usage: `import { ProseEm } from "@zudo-sg/ui/src/content/prose-em/prose-em";

<ProseEm>emphasized text</ProseEm>`,
};

export default meta;

export const Default: Story<ProseEmProps> = {
  name: "Default",
  source: `<ProseEm>emphasized text</ProseEm>`,
  render: () => <ProseEm>emphasized text</ProseEm>,
};
