import type { StoryMeta, Story } from "../stories/types";
import { SiteHeader } from "./site-header";
import { Button } from "../button/button";

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

export const Default: Story = {
  name: "Default",
  // Non-sticky inside the catalog cell so it does not overlay the page.
  render: () => (
    <SiteHeader brand="zudo-sg" nav={nav} activePath="/docs" sticky={false} />
  ),
};

export const WithAction: Story = {
  name: "With action",
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
