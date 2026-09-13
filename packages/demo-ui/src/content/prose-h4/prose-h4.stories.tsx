import type { StoryMeta, Story } from "../../stories/types";
import { ProseH4, type ProseH4Props } from "./prose-h4";

const meta: StoryMeta = {
  title: "ProseH4",
  category: "Typography",
  description: "MDX `h4` element override — body-sized bold heading.",
  usage: `import { ProseH4 } from "@zudo-sg/ui/src/content/prose-h4/prose-h4";

<ProseH4>Detail heading</ProseH4>`,
};

export default meta;

export const Default: Story<ProseH4Props> = {
  name: "Default",
  source: `<ProseH4>Detail heading</ProseH4>`,
  render: () => <ProseH4>Detail heading</ProseH4>,
};
