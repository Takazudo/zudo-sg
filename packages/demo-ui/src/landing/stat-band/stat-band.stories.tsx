import type { StoryMeta, Story } from "../../stories/types";
import { StatBand, type StatBandProps, type BandStat } from "./stat-band";

const meta: StoryMeta = {
  title: "StatBand",
  category: "Landing",
  description:
    "Company-at-a-glance summary band (founding year, capital, headcount, ...). Auto-fit grid with hairline dividers, no media queries.",
  usage: `import { StatBand } from "@zudo-sg/ui/src/landing/stat-band/stat-band";

<StatBand stats={stats} />`,
  order: 9,
};

export default meta;

const STATS: BandStat[] = [
  { value: "1953", unit: "founded", label: "Founding year" },
  { value: "8.1", unit: "billion yen", label: "Capital" },
  { value: "1,500", unit: "employees", label: "Consolidated headcount" },
  { value: "4", unit: "segments", label: "Business segments" },
];

export const Default: Story<StatBandProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "900px" }}>
      <StatBand stats={STATS} />
    </div>
  ),
};

export const CustomStats: Story<StatBandProps> = {
  name: "Custom stats",
  render: () => (
    <div style={{ maxWidth: "900px" }}>
      <StatBand
        stats={[
          { value: "70", unit: "years", label: "In business" },
          { value: "Prime", label: "Listing market" },
          { value: "Taro Yamada", label: "President & CEO" },
        ]}
      />
    </div>
  ),
};

export const Narrow: Story<StatBandProps> = {
  name: "Narrow (mobile-width wrap)",
  render: () => (
    <div style={{ maxWidth: "360px" }}>
      <StatBand stats={STATS} />
    </div>
  ),
};
