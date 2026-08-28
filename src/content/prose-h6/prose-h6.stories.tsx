import type { StoryMeta, Story } from "../../stories/types";
import { ProseH6, type ProseH6Props } from "./prose-h6";

const meta: StoryMeta = {
  title: "ProseH6",
  category: "Typography",
  description: "MDX `h6` element override — the smallest muted heading rung.",
  usage: `import { ProseH6 } from "@zudo-sg/ui/src/content/prose-h6/prose-h6";

<ProseH6>Smallest heading</ProseH6>`,
};

export default meta;

export const Default: Story<ProseH6Props> = {
  name: "Default",
  source: `<ProseH6>Smallest heading</ProseH6>`,
  render: () => <ProseH6>Smallest heading</ProseH6>,
};
