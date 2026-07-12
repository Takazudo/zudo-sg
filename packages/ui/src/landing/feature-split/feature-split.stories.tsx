import type { StoryMeta, Story } from "../../stories/types";
import { FeatureSplit, type FeatureSplitProps } from "./feature-split";

const meta: StoryMeta = {
  title: "FeatureSplit",
  category: "Landing",
  description:
    "Two-pillar positioning section for a company with two distinct sides (e.g. two business lines). Fixed 2-column layout, collapsing to 1 column on narrow screens.",
  usage: `import { FeatureSplit } from "@zudo-sg/ui/src/landing/feature-split/feature-split";

<FeatureSplit
  heading="Two strengths, one company"
  pillars={[
    { index: "01", title: "Electronics", body: "..." },
    { index: "02", title: "Chemicals", body: "..." },
  ]}
/>`,
  order: 2,
};

export default meta;

const PILLARS: [FeatureSplitProps["pillars"][0], FeatureSplitProps["pillars"][1]] = [
  {
    index: "01",
    title: "Electronics trading",
    body: "Sourcing and distributing components across a wide network of manufacturing partners.",
  },
  {
    index: "02",
    title: "Chemical manufacturing",
    body: "Producing specialty chemical materials used across industrial and consumer applications.",
  },
];

export const Default: Story<FeatureSplitProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <FeatureSplit
        eyebrow="Sample Tagline"
        heading="Two strengths, one company"
        lead="A demo company combining a trading business and a manufacturing business under one roof."
        pillars={PILLARS}
      />
    </div>
  ),
};

export const Narrow: Story<FeatureSplitProps> = {
  name: "Narrow (collapses to 1 column)",
  render: () => (
    <div style={{ maxWidth: "420px" }}>
      <FeatureSplit heading="Two strengths, one company" pillars={PILLARS} />
    </div>
  ),
};
