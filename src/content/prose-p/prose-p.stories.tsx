import type { StoryMeta, Story } from "../../stories/types";
import { ProseP, type ProsePProps } from "./prose-p";
import { prosePDisplay } from "./prose-p.composer";

const meta: StoryMeta = {
  ...prosePDisplay,
  usage: `import { ProseP } from "@zudo-sg/ui/src/content/prose-p/prose-p";

<ProseP>Body copy.</ProseP>`,
};

export default meta;

export const Default: Story<ProsePProps> = {
  name: "Default",
  source: `<ProseP>Regular body copy, unadorned.</ProseP>`,
  render: () => <ProseP>Regular body copy, unadorned.</ProseP>,
};
