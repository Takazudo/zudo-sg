import type { StoryMeta, Story } from "../../stories/types";
import { ProseBlockquote, type ProseBlockquoteProps } from "./prose-blockquote";
import { ProseP } from "../prose-p/prose-p";

const meta: StoryMeta = {
  title: "ProseBlockquote",
  category: "Typography",
  description: "MDX `blockquote` element override — muted italic text with a left rule.",
  usage: `import { ProseBlockquote } from "@zudo-sg/ui/src/content/prose-blockquote/prose-blockquote";

<ProseBlockquote>Quoted text.</ProseBlockquote>`,
};

export default meta;

export const Default: Story<ProseBlockquoteProps> = {
  name: "Default",
  source: `<ProseBlockquote>
  <ProseP>A quoted passage, set apart from the surrounding body copy.</ProseP>
</ProseBlockquote>`,
  render: () => (
    <ProseBlockquote>
      <ProseP>A quoted passage, set apart from the surrounding body copy.</ProseP>
    </ProseBlockquote>
  ),
};
