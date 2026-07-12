import type { StoryMeta, Story } from "../../stories/types";
import { GroupCompanyGrid, type GroupCompanyGridProps, type GroupCompany } from "./group-company-grid";

const meta: StoryMeta = {
  title: "GroupCompanyGrid",
  category: "Content",
  description:
    "Card grid listing a company's group/subsidiary companies, each with its business, founding year, and (optional) location.",
  usage: `import { GroupCompanyGrid } from "@zudo-sg/ui/src/landing/group-company-grid/group-company-grid";

<GroupCompanyGrid heading="Group companies" companies={companies} />`,
  order: 12,
};

export default meta;

const COMPANIES: GroupCompany[] = [
  { name: "Example Precision Molding Co., Ltd.", business: "Precision plastic molding manufacturing and sales.", established: "Founded 1983", location: "Example Prefecture" },
  { name: "Example Logistics Co., Ltd.", business: "Contracted logistics operations for the group.", established: "Founded 2003" },
  { name: "Example Labs Inc.", business: "Contract analysis services.", established: "Founded 2020", location: "Example Prefecture" },
];

export const Default: Story<GroupCompanyGridProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "820px" }}>
      <GroupCompanyGrid heading="Group companies" companies={COMPANIES} />
    </div>
  ),
};

export const ManyCards: Story<GroupCompanyGridProps> = {
  name: "Many cards (wrap)",
  render: () => (
    <div style={{ maxWidth: "820px" }}>
      <GroupCompanyGrid
        heading="Group companies"
        companies={[
          ...COMPANIES,
          { name: "Example America Inc.", business: "Electronics business in the United States.", established: "Founded 2002" },
        ]}
      />
    </div>
  ),
};

export const Bare: Story<GroupCompanyGridProps> = {
  name: "Bare (no heading, for MDX body embedding)",
  render: () => (
    <div style={{ maxWidth: "820px" }}>
      <GroupCompanyGrid companies={COMPANIES} bare />
    </div>
  ),
};
