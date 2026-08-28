import type { StoryMeta, Story } from "../../stories/types";
import { DiscoveryTeaser, type DiscoveryTeaserProps, type DiscoveryScene } from "./discovery-teaser";

const meta: StoryMeta = {
  title: "DiscoveryTeaser",
  category: "Landing",
  description:
    "Top-page excerpt showing a handful of \"where our products show up\" scenes, teasing through to a fuller scene gallery page.",
  usage: `import { DiscoveryTeaser } from "@zudo-sg/ui/src/landing/discovery-teaser/discovery-teaser";

<DiscoveryTeaser heading="Everyday places you'll find us" scenes={scenes} href="/company/discovery" />`,
  order: 5,
};

export default meta;

const SCENES: DiscoveryScene[] = [
  { title: "Cars", body: "LiDAR optical filters and image-processing chips support advanced driver assistance." },
  { title: "Schools", body: "Camera modules and interactive whiteboards support digital classrooms." },
  { title: "Hospitals", body: "Components embedded in medical devices, plus hygiene-focused chemical products." },
  { title: "Solar farms", body: "Power device and conditioner components support stable renewable operation." },
];

export const Default: Story<DiscoveryTeaserProps> = {
  name: "Default",
  render: () => (
    <div style={{ maxWidth: "960px" }}>
      <DiscoveryTeaser
        heading="Everyday places you'll find us"
        intro="Our products show up in daily life and industry in ways you might not expect."
        scenes={SCENES}
        href="/company/discovery"
      />
    </div>
  ),
};

export const Narrow: Story<DiscoveryTeaserProps> = {
  name: "Narrow (card wrap)",
  render: () => (
    <div style={{ maxWidth: "380px" }}>
      <DiscoveryTeaser heading="Everyday places you'll find us" scenes={SCENES} href="/company/discovery" />
    </div>
  ),
};
