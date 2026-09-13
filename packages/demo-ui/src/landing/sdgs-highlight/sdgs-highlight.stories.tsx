import type { StoryMeta, Story } from "../../stories/types";
import { SdgsHighlight, type SdgsHighlightProps, type SdgsInitiative } from "./sdgs-highlight";

const meta: StoryMeta = {
  title: "SdgsHighlight",
  category: "Landing",
  description:
    "Top-page excerpt of a company's sustainability initiatives, shown as accent cards, teasing through to the full sustainability page.",
  usage: `import { SdgsHighlight } from "@zudo-sg/ui/src/landing/sdgs-highlight/sdgs-highlight";

<SdgsHighlight heading="Working toward a sustainable future" initiatives={initiatives} href="/sustainability/sdgs" />`,
  order: 7,
};

export default meta;

const INITIATIVES: SdgsInitiative[] = [
  { title: "Environmentally conscious products", body: "Expanding a product lineup that supports climate action and resource circulation." },
  { title: "Efficient resource use", body: "Solar power and LED lighting across our domestic sites reduce energy use." },
  { title: "Community contribution", body: "Employment support and forest volunteering connect us with local communities." },
];

export const Default: Story<SdgsHighlightProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <SdgsHighlight
        eyebrow="Sustainability"
        heading="Working toward a sustainable future"
        lead="Guided by our vision of coexistence between people, technology, and nature."
        initiatives={INITIATIVES}
        href="/sustainability/sdgs"
      />
    </div>
  ),
};

export const Narrow: Story<SdgsHighlightProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <SdgsHighlight heading="Working toward a sustainable future" initiatives={INITIATIVES} href="/sustainability/sdgs" />
    </div>
  ),
};
