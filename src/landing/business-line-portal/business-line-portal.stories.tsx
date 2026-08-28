import type { StoryMeta, Story } from "../../stories/types";
import {
  BusinessLinePortal,
  type BusinessLinePortalProps,
  type BusinessLinePortalLine,
} from "./business-line-portal";

const meta: StoryMeta = {
  title: "BusinessLinePortal",
  category: "Landing",
  description:
    "Card-grid portal listing a company's business lines, each linking through to its own line landing page. Supports filtering to a subset via `only`, and a `bare` mode for embedding in body copy.",
  usage: `import { BusinessLinePortal } from "@zudo-sg/ui/src/landing/business-line-portal/business-line-portal";

<BusinessLinePortal heading="Our business lines" lines={lines} />`,
  order: 4,
};

export default meta;

const LINES: BusinessLinePortalLine[] = [
  { key: "vacuum", label: "Vacuum Systems", description: "Vacuum equipment, gauges, and integrated solutions.", href: "/lines/vacuum" },
  { key: "process", label: "Process Materials", description: "Specialty materials for advanced manufacturing processes.", href: "/lines/process" },
  { key: "laser", label: "Laser Solutions", description: "Laser sources, optics, and application engineering.", href: "/lines/laser" },
  { key: "meeting", label: "Meeting Systems", description: "Conferencing hardware and workplace collaboration tools.", href: "/lines/meeting" },
  { key: "beauty", label: "Beauty Brand", description: "A skincare and cosmetics brand under the group.", href: "/lines/beauty" },
];

export const Default: Story<BusinessLinePortalProps> = {
  name: "Default (all lines)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <BusinessLinePortal
        heading="Our business lines"
        intro="Five specialized lines, each with its own site and product lineup."
        lines={LINES}
      />
    </div>
  ),
};

export const Filtered: Story<BusinessLinePortalProps> = {
  name: "Filtered subset (only)",
  render: () => (
    <div style={{ maxWidth: "720px" }}>
      <BusinessLinePortal heading="Featured lines" lines={LINES} only={["vacuum", "laser"]} />
    </div>
  ),
};

export const Bare: Story<BusinessLinePortalProps> = {
  name: "Bare (no heading, for MDX body embedding)",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <BusinessLinePortal lines={LINES} bare />
    </div>
  ),
};
