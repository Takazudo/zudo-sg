import type { StoryMeta, Story } from "../../stories/types";
import { ProseH3, type ProseH3Props } from "./prose-h3";

const meta: StoryMeta = {
  title: "ProseH3",
  category: "Typography",
  description: "MDX `h3` element override — subsection heading with an accent-colored left rule.",
  usage: `import { ProseH3 } from "@zudo-sg/ui/src/content/prose-h3/prose-h3";

<ProseH3>Subsection heading</ProseH3>`,
};

export default meta;

export const Default: Story<ProseH3Props> = {
  name: "Default",
  source: `<ProseH3>Subsection heading</ProseH3>`,
  render: () => <ProseH3>Subsection heading</ProseH3>,
};
