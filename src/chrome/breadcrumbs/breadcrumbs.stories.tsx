import type { StoryMeta, Story } from "../../stories/types";
import { Breadcrumbs, type BreadcrumbsProps } from "./breadcrumbs";

const meta: StoryMeta = {
  title: "Breadcrumbs",
  category: "Navigation",
  description: 'Home > section > current-page trail. Renders nothing for a single ("home only") crumb.',
  usage: `import { Breadcrumbs } from "@zudo-sg/ui";

<Breadcrumbs crumbs={crumbs} />`,
};

export default meta;

export const InSection: Story<BreadcrumbsProps> = {
  name: "Page inside a section",
  source: `<Breadcrumbs
  crumbs={[
    { label: "Home", href: "/" },
    { label: "Company", href: "/company" },
    { label: "Company profile" },
  ]}
/>`,
  render: () => (
    <Breadcrumbs
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Company", href: "/company" },
        { label: "Company profile" },
      ]}
    />
  ),
};

export const SectionWithoutTopLink: Story<BreadcrumbsProps> = {
  name: "Section with no top-level link",
  source: `<Breadcrumbs
  crumbs={[{ label: "Home", href: "/" }, { label: "Unlisted section" }]}
/>`,
  render: () => <Breadcrumbs crumbs={[{ label: "Home", href: "/" }, { label: "Unlisted section" }]} />,
};

export const TopPageRendersNothing: Story<BreadcrumbsProps> = {
  name: "Top page renders nothing",
  source: `<Breadcrumbs crumbs={[{ label: "Home", href: "/" }]} />`,
  render: () => (
    <div>
      <p class="text-small text-muted">
        The home page has a single crumb, so nothing renders below (that's correct — there's nothing after it).
      </p>
      <Breadcrumbs crumbs={[{ label: "Home", href: "/" }]} />
    </div>
  ),
};
