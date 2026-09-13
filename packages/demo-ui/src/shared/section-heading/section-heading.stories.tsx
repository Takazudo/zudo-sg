import type { StoryMeta, Story } from "../../stories/types";
import { SectionHeading, type SectionHeadingProps } from "./section-heading";

const meta: StoryMeta = {
  title: "SectionHeading",
  category: "Content",
  description: "Section header block: optional eyebrow, heading, and an optional intro paragraph.",
  usage: `import { SectionHeading } from "@zudo-sg/ui/src/shared/section-heading/section-heading";

<SectionHeading heading="Product lines" intro="Four lines across two divisions." />`,
};

export default meta;

export const Default: Story<SectionHeadingProps> = {
  name: "Heading + intro",
  source: `<SectionHeading
  heading="Product lines"
  intro="We combine trading and manufacturing expertise across four product lines."
/>`,
  render: () => (
    <SectionHeading
      heading="Product lines"
      intro="We combine trading and manufacturing expertise across four product lines."
    />
  ),
};

export const HeadingOnly: Story<SectionHeadingProps> = {
  name: "Heading only",
  source: `<SectionHeading heading="Our strengths" />`,
  render: () => <SectionHeading heading="Our strengths" />,
};

export const WithEyebrow: Story<SectionHeadingProps> = {
  name: "With eyebrow",
  source: `<SectionHeading
  eyebrow="Sustainability"
  heading="Building a sustainable future"
  intro="We contribute to environmental, social, and economic sustainability through our business."
/>`,
  render: () => (
    <SectionHeading
      eyebrow="Sustainability"
      heading="Building a sustainable future"
      intro="We contribute to environmental, social, and economic sustainability through our business."
    />
  ),
};
