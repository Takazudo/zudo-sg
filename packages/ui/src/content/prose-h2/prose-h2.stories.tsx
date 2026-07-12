import type { StoryMeta, Story } from "../../stories/types";
import { ProseH2, type ProseH2Props } from "./prose-h2";

const meta: StoryMeta = {
  title: "ProseH2",
  category: "Typography",
  description: "MDX `h2` element override — section heading with a bottom rule.",
  usage: `import { ProseH2 } from "@zudo-sg/ui/src/content/prose-h2/prose-h2";

<ProseH2>Section heading</ProseH2>`,
};

export default meta;

export const Default: Story<ProseH2Props> = {
  name: "Default",
  source: `<ProseH2>Section heading</ProseH2>`,
  render: () => <ProseH2>Section heading</ProseH2>,
};
