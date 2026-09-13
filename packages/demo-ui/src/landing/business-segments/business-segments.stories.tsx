import type { StoryMeta, Story } from "../../stories/types";
import { BusinessSegments, type BusinessSegmentsProps, type BusinessSegment } from "./business-segments";

const meta: StoryMeta = {
  title: "BusinessSegments",
  category: "Landing",
  description:
    "Top-page card grid summarizing a company's business segments, each linking through to its own detail page.",
  usage: `import { BusinessSegments } from "@zudo-sg/ui/src/landing/business-segments/business-segments";

<BusinessSegments heading="Our business" segments={segments} />`,
  order: 3,
};

export default meta;

const SEGMENTS: BusinessSegment[] = [
  { title: "Electronic devices", body: "Sensors and modules for a wide range of applications.", href: "/products/electronic-devices" },
  { title: "Components", body: "Precision components sourced from a trusted partner network.", href: "/products/components" },
  { title: "Equipment", body: "Industrial equipment and systems integration services.", href: "/products/equipment" },
  { title: "Chemical materials", body: "Specialty chemical materials for industrial applications.", href: "/products/chemical" },
];

export const Default: Story<BusinessSegmentsProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <BusinessSegments
        heading="Our business segments"
        intro="Four segments, one company — a quick look at what we do."
        segments={SEGMENTS}
      />
    </div>
  ),
};

export const Narrow: Story<BusinessSegmentsProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <BusinessSegments heading="Our business segments" segments={SEGMENTS} />
    </div>
  ),
};
