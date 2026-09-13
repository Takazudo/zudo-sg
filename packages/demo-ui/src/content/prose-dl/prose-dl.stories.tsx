import type { StoryMeta, Story } from "../../stories/types";
import { ProseDl, ProseDt, ProseDd, type ProseDlProps } from "./prose-dl";

const meta: StoryMeta = {
  title: "ProseDl",
  category: "Typography",
  description: "MDX `dl`/`dt`/`dd` element overrides — a definition list with bold terms and muted descriptions.",
  usage: `import { ProseDl, ProseDt, ProseDd } from "@zudo-sg/ui/src/content/prose-dl/prose-dl";

<ProseDl>
  <ProseDt>hsp</ProseDt>
  <ProseDd>Horizontal spacing token axis.</ProseDd>
</ProseDl>`,
};

export default meta;

export const Default: Story<ProseDlProps> = {
  name: "Default",
  source: `<ProseDl>
  <ProseDt>hsp</ProseDt>
  <ProseDd>Horizontal spacing token axis.</ProseDd>
  <ProseDt>vsp</ProseDt>
  <ProseDd>Vertical spacing token axis.</ProseDd>
</ProseDl>`,
  render: () => (
    <ProseDl>
      <ProseDt>hsp</ProseDt>
      <ProseDd>Horizontal spacing token axis.</ProseDd>
      <ProseDt>vsp</ProseDt>
      <ProseDd>Vertical spacing token axis.</ProseDd>
    </ProseDl>
  ),
};
