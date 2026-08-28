import type { StoryMeta, Story } from "../../stories/types";
import { StrengthList, type StrengthListProps, type Strength } from "./strength-list";

const meta: StoryMeta = {
  title: "StrengthList",
  category: "Content",
  description:
    "Enumerated \"large number + title + body\" strengths list, stacked vertically with hairline dividers between entries.",
  usage: `import { StrengthList } from "@zudo-sg/ui/src/landing/strength-list/strength-list";

<StrengthList heading="Our strengths" strengths={strengths} />`,
  order: 18,
};

export default meta;

const STRENGTHS: Strength[] = [
  { no: "01", title: "Broad supplier network", body: "Decades of relationships across component and material suppliers." },
  { no: "02", title: "In-house manufacturing", body: "Direct control over quality and lead times for chemical materials." },
  { no: "03", title: "Cross-industry reach", body: "Serving automotive, medical, and industrial customers alike." },
  { no: "04", title: "Engineering support", body: "Technical staff who work alongside customers on product fit." },
];

export const Default: Story<StrengthListProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <StrengthList heading="Our strengths" strengths={STRENGTHS} />
    </div>
  ),
};

export const Narrow: Story<StrengthListProps> = {
  name: "Narrow (number stacks above body)",
  render: () => (
    <div style={{ maxWidth: "360px" }}>
      <StrengthList heading="Our strengths" strengths={STRENGTHS} />
    </div>
  ),
};
