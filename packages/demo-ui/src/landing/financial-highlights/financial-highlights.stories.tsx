import type { StoryMeta, Story } from "../../stories/types";
import { FinancialHighlights, type FinancialHighlightsProps, type FinancialMetric } from "./financial-highlights";

const meta: StoryMeta = {
  title: "FinancialHighlights",
  category: "Data Display",
  description:
    "IR \"financial highlights\" metrics summary grid. A metric with no `value` renders `pendingLabel` instead of an invented figure.",
  usage: `import { FinancialHighlights } from "@zudo-sg/ui/src/landing/financial-highlights/financial-highlights";

<FinancialHighlights heading="Financial highlights" metrics={metrics} />`,
  order: 15,
};

export default meta;

const PENDING_METRICS: FinancialMetric[] = [
  { label: "Net sales", unit: "million yen" },
  { label: "Operating profit", unit: "million yen" },
  { label: "Ordinary profit", unit: "million yen" },
  { label: "Profit attributable to owners", unit: "million yen" },
  { label: "Dividend per share", unit: "yen" },
  { label: "Earnings per share", unit: "yen" },
];

export const Default: Story<FinancialHighlightsProps> = {
  name: "Default (values not yet published)",
  render: () => (
    <div style={{ maxWidth: "880px" }}>
      <FinancialHighlights heading="Financial highlights" metrics={PENDING_METRICS} />
    </div>
  ),
};

export const WithValues: Story<FinancialHighlightsProps> = {
  name: "With values",
  render: () => (
    <div style={{ maxWidth: "880px" }}>
      <FinancialHighlights
        heading="Financial highlights"
        metrics={[
          { label: "Net sales", unit: "million yen", value: "82,340" },
          { label: "Operating profit", unit: "million yen", value: "6,120" },
          { label: "Ordinary profit", unit: "million yen", value: "6,480" },
          { label: "Dividend per share", unit: "yen", value: "48" },
        ]}
      />
    </div>
  ),
};

export const Narrow: Story<FinancialHighlightsProps> = {
  name: "Narrow (cell wrap)",
  render: () => (
    <div style={{ maxWidth: "360px" }}>
      <FinancialHighlights heading="Financial highlights" metrics={PENDING_METRICS} />
    </div>
  ),
};
