import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { SectionHeading, type SectionHeadingProps } from "./section-heading";

const meta: StoryMeta = {
  title: "SectionHeading",
  category: "Content",
  description: "Section header block: optional eyebrow, heading, and an optional intro paragraph.",
  usage: `import { SectionHeading } from "@zudo-sg/ui/src/shared/section-heading/section-heading";

<SectionHeading heading="Product lines" intro="Four lines across two divisions." />`,
  // Leaf: eyebrow/heading/intro are scalar text fields (never a structural
  // slot) — `heading` is the one inline-editable field; the adapter resolves
  // to the rendered <h1>/<h2> specifically, since the component's root wraps
  // it alongside the (non-editable) eyebrow/intro regions.
  composer: defineComposer<SectionHeadingProps>({
    componentId: "ui.section-heading",
    version: 1,
    component: SectionHeading,
    source: {
      module: "@zudo-sg/ui/src/shared/section-heading/section-heading",
      exportKind: "named",
      exportName: "SectionHeading",
    },
    defaults: {
      eyebrow: "About",
      heading: "Our approach",
      intro: "A short supporting sentence.",
    },
    fields: [
      { kind: "text", prop: "eyebrow", label: "Eyebrow" },
      { kind: "text", prop: "heading", label: "Heading", inlineEdit: {} },
      { kind: "text", prop: "intro", label: "Intro" },
    ],
    adapters: {
      inlineEditor: {
        field: "heading",
        resolveElement: (root) => root.querySelector<HTMLHeadingElement>("h1, h2"),
      },
    },
  }),
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
