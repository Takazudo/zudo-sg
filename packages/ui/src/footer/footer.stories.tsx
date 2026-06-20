import type { StoryMeta, Story } from "../stories/types";
import { SiteFooter } from "./footer";

const meta: StoryMeta = {
  title: "SiteFooter",
  category: "Navigation",
  description: "Site footer with brand + tagline, grouped nav columns, and a copyright row.",
  usage: `import { SiteFooter } from "@zudo-sg/ui";

<SiteFooter
  brand="zudo-sg"
  tagline="A tight component system."
  groups={[{ heading: "Product", links: [{ label: "Docs", href: "/docs" }] }]}
  copyright="© 2026 zudo-sg"
/>`,
  order: 2,
};

export default meta;

const groups = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Docs",
    links: [
      { label: "Getting started", href: "/docs" },
      { label: "Components", href: "/docs/components" },
      { label: "Tokens", href: "/docs/tokens" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const Default: Story = {
  name: "Default",
  render: () => (
    <SiteFooter
      brand="zudo-sg"
      tagline="A tight, dark-correct Preact component system built on shared design tokens."
      groups={groups}
      copyright="© 2026 zudo-sg. Built with zfb."
    />
  ),
};

export const Minimal: Story = {
  name: "Minimal (no groups)",
  render: () => (
    <SiteFooter
      brand="zudo-sg"
      tagline="A demo footer with just a brand and copyright."
      copyright="© 2026 zudo-sg."
    />
  ),
};
