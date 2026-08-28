import type { StoryMeta, Story } from "../../stories/types";
import { ProseUl, type ProseUlProps } from "./prose-ul";
import { ProseLi } from "../prose-li/prose-li";

const meta: StoryMeta = {
  title: "ProseUl",
  category: "Typography",
  description: "MDX `ul` element override — disc-marked list.",
  usage: `import { ProseUl } from "@zudo-sg/ui/src/content/prose-ul/prose-ul";
import { ProseLi } from "@zudo-sg/ui/src/content/prose-li/prose-li";

<ProseUl>
  <ProseLi>Item one</ProseLi>
</ProseUl>`,
};

export default meta;

export const Default: Story<ProseUlProps> = {
  name: "Default",
  source: `<ProseUl>
  <ProseLi>Item one</ProseLi>
  <ProseLi>Item two</ProseLi>
</ProseUl>`,
  render: () => (
    <ProseUl>
      <ProseLi>Item one</ProseLi>
      <ProseLi>Item two</ProseLi>
    </ProseUl>
  ),
};
