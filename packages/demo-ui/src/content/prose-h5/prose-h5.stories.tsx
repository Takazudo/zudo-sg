import type { StoryMeta, Story } from "../../stories/types";
import { ProseH5, type ProseH5Props } from "./prose-h5";

const meta: StoryMeta = {
  title: "ProseH5",
  category: "Typography",
  description: "MDX `h5` element override — muted minor heading.",
  usage: `import { ProseH5 } from "@zudo-sg/ui/src/content/prose-h5/prose-h5";

<ProseH5>Minor heading</ProseH5>`,
};

export default meta;

export const Default: Story<ProseH5Props> = {
  name: "Default",
  source: `<ProseH5>Minor heading</ProseH5>`,
  render: () => <ProseH5>Minor heading</ProseH5>,
};
