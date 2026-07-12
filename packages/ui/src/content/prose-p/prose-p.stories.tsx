import type { StoryMeta, Story } from "../../stories/types";
import { ProseP, type ProsePProps } from "./prose-p";

const meta: StoryMeta = {
  title: "ProseP",
  category: "Typography",
  description: "MDX `p` element override — plain paragraph; flow spacing is owned by the consumer's content-flow stylesheet.",
  usage: `import { ProseP } from "@zudo-sg/ui/src/content/prose-p/prose-p";

<ProseP>Body copy.</ProseP>`,
};

export default meta;

export const Default: Story<ProsePProps> = {
  name: "Default",
  source: `<ProseP>Regular body copy, unadorned.</ProseP>`,
  render: () => <ProseP>Regular body copy, unadorned.</ProseP>,
};
