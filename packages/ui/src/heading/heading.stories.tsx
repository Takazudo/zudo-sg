import type { StoryMeta, Story } from "../stories/types";
import { PageHeading, SectionHeading } from "./heading";
import { Link } from "../link/link";

// Neither Props type is exported; derive them from the components themselves.
type PageHeadingProps = Parameters<typeof PageHeading>[0];
type SectionHeadingProps = Parameters<typeof SectionHeading>[0];

const meta: StoryMeta = {
  title: "Headings",
  category: "Typography",
  description: "Page- and section-level heading blocks with optional eyebrow, description, and action.",
  usage: `import { PageHeading, SectionHeading } from "@zudo-sg/ui";

<PageHeading eyebrow="Guide" description="…">Getting started</PageHeading>
<SectionHeading description="…">Features</SectionHeading>`,
  order: 1,
};

export default meta;

export const Playground: Story<PageHeadingProps> = {
  name: "Playground",
  source: `<PageHeading as="h1" eyebrow="Documentation" description="A coherent set of Preact components.">
  Build with zudo-sg
</PageHeading>`,
  controls: [
    {
      type: "select",
      prop: "as",
      label: "Level",
      options: ["h1", "h2"],
      defaultValue: "h1",
    },
    {
      type: "text",
      prop: "eyebrow",
      label: "Eyebrow",
      defaultValue: "Documentation",
    },
    {
      type: "text",
      prop: "children",
      label: "Heading text",
      defaultValue: "Build with zudo-sg",
    },
    {
      type: "text",
      prop: "description",
      label: "Description",
      defaultValue: "A coherent set of Preact components.",
    },
  ],
  render: (args = {}) => (
    <PageHeading as={args.as} eyebrow={args.eyebrow} description={args.description}>
      {args.children}
    </PageHeading>
  ),
};

export const Page: Story<PageHeadingProps> = {
  name: "PageHeading",
  source: `<PageHeading
  eyebrow="Documentation"
  description="A coherent set of Preact components styled with tight design tokens — dark-mode correct out of the box."
>
  Build with zudo-sg
</PageHeading>`,
  render: () => (
    <PageHeading
      eyebrow="Documentation"
      description="A coherent set of Preact components styled with tight design tokens — dark-mode correct out of the box."
    >
      Build with zudo-sg
    </PageHeading>
  ),
};

export const Section: Story<SectionHeadingProps> = {
  name: "SectionHeading",
  source: `<SectionHeading description="Everything you need to assemble a marketing page.">
  Components
</SectionHeading>`,
  render: () => (
    <SectionHeading description="Everything you need to assemble a marketing page.">
      Components
    </SectionHeading>
  ),
};

export const SectionWithAction: Story<SectionHeadingProps> = {
  name: "SectionHeading with action",
  source: `<SectionHeading
  description="The most recently published entries."
  action={<Link href="/articles" variant="standalone">View all</Link>}
>
  Latest articles
</SectionHeading>`,
  render: () => (
    <SectionHeading
      description="The most recently published entries."
      action={
        <Link href="/articles" variant="standalone">
          View all
        </Link>
      }
    >
      Latest articles
    </SectionHeading>
  ),
};
