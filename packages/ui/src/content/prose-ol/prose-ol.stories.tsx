import type { StoryMeta, Story } from "../../stories/types";
import { ProseOl, type ProseOlProps } from "./prose-ol";
import { ProseLi } from "../prose-li/prose-li";

const meta: StoryMeta = {
  title: "ProseOl",
  category: "Typography",
  description: "MDX `ol` element override — decimal-numbered list.",
  usage: `import { ProseOl } from "@zudo-sg/ui/src/content/prose-ol/prose-ol";
import { ProseLi } from "@zudo-sg/ui/src/content/prose-li/prose-li";

<ProseOl>
  <ProseLi>Step one</ProseLi>
</ProseOl>`,
};

export default meta;

export const Default: Story<ProseOlProps> = {
  name: "Default",
  source: `<ProseOl>
  <ProseLi>Step one</ProseLi>
  <ProseLi>Step two</ProseLi>
  <ProseLi>Step three</ProseLi>
</ProseOl>`,
  render: () => (
    <ProseOl>
      <ProseLi>Step one</ProseLi>
      <ProseLi>Step two</ProseLi>
      <ProseLi>Step three</ProseLi>
    </ProseOl>
  ),
};
