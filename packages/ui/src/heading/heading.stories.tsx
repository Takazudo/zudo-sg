import type { StoryMeta, Story } from "../stories/types";
import { PageHeading, SectionHeading } from "./heading";
import { Link } from "../link/link";

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

export const Page: Story = {
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

export const Section: Story = {
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

export const SectionWithAction: Story = {
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
