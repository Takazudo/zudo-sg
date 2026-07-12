import type { StoryMeta, Story } from "../../stories/types";
import { RecruitBand, type RecruitBandProps } from "./recruit-band";

const meta: StoryMeta = {
  title: "RecruitBand",
  category: "Landing",
  description:
    "Full-width \"we're hiring\" band pairing a heading/lead with a single prominent CTA to a recruiting page. Same soft accent-tinted band idiom as Hero.",
  usage: `import { RecruitBand } from "@zudo-sg/ui/src/landing/recruit-band/recruit-band";

<RecruitBand heading="Join our team" href="/recruit" />`,
  order: 6,
};

export default meta;

export const Default: Story<RecruitBandProps> = {
  name: "Default",
  render: () => (
    <RecruitBand
      eyebrow="Recruit"
      heading="Build the future with us"
      lead="We're looking for people who want to tackle real-world challenges across two industries."
      href="/recruit"
    />
  ),
};

export const CustomCopy: Story<RecruitBandProps> = {
  name: "Custom copy",
  render: () => (
    <RecruitBand
      heading="Your next challenge starts here"
      lead="Explore open roles across engineering, sales, and manufacturing."
      href="/recruit"
      ctaLabel="See open roles"
    />
  ),
};
