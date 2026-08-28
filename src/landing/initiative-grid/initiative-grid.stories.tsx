import type { StoryMeta, Story } from "../../stories/types";
import { InitiativeGrid, type InitiativeGridProps, type Initiative } from "./initiative-grid";

const meta: StoryMeta = {
  title: "InitiativeGrid",
  category: "Content",
  description:
    "Sustainability-style \"initiative\" card grid, each card numbered and top-rule accented.",
  usage: `import { InitiativeGrid } from "@zudo-sg/ui/src/landing/initiative-grid/initiative-grid";

<InitiativeGrid heading="Our initiatives" initiatives={initiatives} />`,
  order: 20,
};

export default meta;

const SOLAR_INITIATIVES: Initiative[] = [
  { title: "Example Plant Solar Farm", body: "A rooftop solar installation supplying part of the plant's own power needs." },
  { title: "Example Research Center Solar Farm", body: "Ground-mounted panels feeding the research center's grid connection." },
  { title: "Example Logistics Solar Farm", body: "Warehouse-roof solar generation offsetting logistics operations." },
  { title: "Example Branch Solar Farm", body: "A regional branch site contributing to the group's renewable capacity." },
  { title: "Example Overseas Solar Farm", body: "An overseas subsidiary site with its own solar generation program." },
];

export const Default: Story<InitiativeGridProps> = {
  name: "Default (5 initiatives)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <InitiativeGrid heading="Our solar power initiatives" initiatives={SOLAR_INITIATIVES} />
    </div>
  ),
};

export const Sdgs: Story<InitiativeGridProps> = {
  name: "SDGs initiatives (data swap)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <InitiativeGrid
        heading="Our SDGs initiatives"
        intro="Contributing to the SDGs through both our business activities and community engagement."
        initiatives={[
          { title: "Reducing ocean plastic", body: "Producing and distributing reusable bags to cut single-use plastic." },
          { title: "Protecting biodiversity", body: "Participating in forest volunteering to support local ecosystems." },
          { title: "Environmentally conscious skincare", body: "A cosmetics brand built around reduced environmental impact." },
        ]}
      />
    </div>
  ),
};

export const Narrow: Story<InitiativeGridProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <InitiativeGrid heading="Our solar power initiatives" initiatives={SOLAR_INITIATIVES} />
    </div>
  ),
};
