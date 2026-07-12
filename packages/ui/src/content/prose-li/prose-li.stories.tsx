import type { StoryMeta, Story } from "../../stories/types";
import { ProseLi, type ProseLiProps } from "./prose-li";
import { ProseUl } from "../prose-ul/prose-ul";

const meta: StoryMeta = {
  title: "ProseLi",
  category: "Typography",
  description: "MDX `li` element override — muted marker with nested-list spacing resets.",
  usage: `import { ProseLi } from "@zudo-sg/ui/src/content/prose-li/prose-li";

<ProseLi>List item</ProseLi>`,
};

export default meta;

export const Default: Story<ProseLiProps> = {
  name: "Default",
  source: `<ProseUl>
  <ProseLi>Item one</ProseLi>
  <ProseLi>
    Item two
    <ProseUl>
      <ProseLi>Nested item</ProseLi>
    </ProseUl>
  </ProseLi>
</ProseUl>`,
  render: () => (
    <ProseUl>
      <ProseLi>Item one</ProseLi>
      <ProseLi>
        Item two
        <ProseUl>
          <ProseLi>Nested item</ProseLi>
        </ProseUl>
      </ProseLi>
    </ProseUl>
  ),
};
