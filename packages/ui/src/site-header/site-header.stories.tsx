import type { StoryMeta, Story } from "../stories/types";
import { SiteHeader } from "./site-header";
import { Button } from "../button/button";

// SiteHeaderProps isn't exported; derive it from the component itself.
type SiteHeaderProps = Parameters<typeof SiteHeader>[0];

const meta: StoryMeta = {
  title: "SiteHeader",
  category: "Navigation",
  description: "Sticky site header: brand, primary nav with active state, and an optional action slot.",
  usage: `import { SiteHeader } from "@zudo-sg/ui";

<SiteHeader
  brand="zudo-sg"
  nav={[{ label: "Docs", href: "/docs" }]}
  activePath="/docs"
/>`,
  order: 1,
};

export default meta;

const nav = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export const Default: Story<SiteHeaderProps> = {
  name: "Default",
  source: `<SiteHeader brand="zudo-sg" nav={nav} activePath="/docs" />`,
  // Non-sticky inside the catalog cell so it does not overlay the page.
  render: () => (
    <SiteHeader brand="zudo-sg" nav={nav} activePath="/docs" sticky={false} />
  ),
};

export const WithAction: Story<SiteHeaderProps> = {
  name: "With action",
  source: `<SiteHeader
  brand="zudo-sg"
  nav={nav}
  activePath="/"
  action={<Button size="sm" href="/start">Get started</Button>}
/>`,
  render: () => (
    <SiteHeader
      brand="zudo-sg"
      nav={nav}
      activePath="/"
      sticky={false}
      action={
        <Button size="sm" href="/start">
          Get started
        </Button>
      }
    />
  ),
};
