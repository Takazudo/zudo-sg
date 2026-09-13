import type { StoryMeta, Story } from "../../stories/types";
import { CompanyProfileTable, type CompanyProfileTableProps, type CompanyProfileRow } from "./company-profile-table";

const meta: StoryMeta = {
  title: "CompanyProfileTable",
  category: "Data Display",
  description:
    "Company-profile \"label / value\" definition list — rows separated by hairline rules, the whole table framed in one rounded border.",
  usage: `import { CompanyProfileTable } from "@zudo-sg/ui/src/landing/company-profile-table/company-profile-table";

<CompanyProfileTable rows={rows} />`,
  order: 11,
};

export default meta;

const ROWS: CompanyProfileRow[] = [
  { label: "Company name", value: "Example Co., Ltd." },
  { label: "Founded", value: "November 7, 1953" },
  { label: "Capital", value: "8.1 billion yen" },
  { label: "Representative", value: "Taro Yamada, President & CEO" },
  { label: "Head office", value: "1-1-1 Example, Example Ward, Example City" },
  { label: "Listing", value: "Tokyo Stock Exchange, Prime Market" },
  { label: "Employees", value: "Consolidated 1,500 / Non-consolidated 800" },
  { label: "Business", value: "Sample business description goes here." },
];

export const Default: Story<CompanyProfileTableProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "640px" }}>
      <CompanyProfileTable rows={ROWS} />
    </div>
  ),
};

export const CustomRows: Story<CompanyProfileTableProps> = {
  name: "Custom rows (any count)",
  render: () => (
    <div style={{ maxWidth: "640px" }}>
      <CompanyProfileTable
        rows={[
          { label: "Company name", value: "Example Co., Ltd." },
          { label: "Listing", value: "Tokyo Stock Exchange, Prime Market" },
          { label: "Representative", value: "Taro Yamada, President & CEO" },
        ]}
      />
    </div>
  ),
};

export const Narrow: Story<CompanyProfileTableProps> = {
  name: "Narrow (label stacks above value)",
  render: () => (
    <div style={{ maxWidth: "360px" }}>
      <CompanyProfileTable rows={ROWS} />
    </div>
  ),
};
