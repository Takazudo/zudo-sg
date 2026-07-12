import type { StoryMeta, Story } from "../../stories/types";
import { ValuePillars, type ValuePillarsProps, type ValuePillar } from "./value-pillars";

const meta: StoryMeta = {
  title: "ValuePillars",
  category: "Content",
  description:
    "Numbered card grid for a \"where we create value\" positioning section — an accent number badge over a title and body.",
  usage: `import { ValuePillars } from "@zudo-sg/ui/src/landing/value-pillars/value-pillars";

<ValuePillars heading="Where we create value" pillars={pillars} />`,
  order: 16,
};

export default meta;

const PILLARS: ValuePillar[] = [
  { title: "Trading network", body: "A wide supplier and customer network built over decades of electronics trading." },
  { title: "Manufacturing know-how", body: "In-house chemical manufacturing expertise applied to new material development." },
  { title: "Combined positioning", body: "Sitting between trading and manufacturing lets us move faster on new opportunities." },
];

export const Default: Story<ValuePillarsProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <ValuePillars heading="Where we create value" intro="Three strengths that shape how we build new business." pillars={PILLARS} />
    </div>
  ),
};

export const Narrow: Story<ValuePillarsProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <ValuePillars heading="Where we create value" pillars={PILLARS} />
    </div>
  ),
};
