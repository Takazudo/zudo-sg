import type { StoryMeta, Story } from "../../stories/types";
import { Hero, type HeroProps } from "./hero";

const meta: StoryMeta = {
  title: "Hero",
  category: "Content",
  description:
    "First-view hero band: eyebrow + display heading + lead + CTA row over a soft accent-tinted background.",
  usage: `import { Hero } from "@zudo-sg/ui/src/shared/hero/hero";

<Hero
  eyebrow="Welcome"
  heading="Build things that last"
  lead="A sample lead paragraph."
  actions={[{ label: "Get started", href: "/docs", variant: "primary" }]}
/>`,
};

export default meta;

export const Primary: Story<HeroProps> = {
  name: "Primary (page hero)",
  source: `<Hero
  variant="primary"
  eyebrow="Sample Co."
  heading="Build things that last"
  lead="A demo company combining two imaginary product lines into one storefront."
  actions={[
    { label: "Browse products", href: "/products", variant: "primary" },
    { label: "About us", href: "/company", variant: "secondary" },
  ]}
/>`,
  render: () => (
    <Hero
      variant="primary"
      eyebrow="Sample Co."
      heading="Build things that last"
      lead="A demo company combining two imaginary product lines into one storefront."
      actions={[
        { label: "Browse products", href: "/products", variant: "primary" },
        { label: "About us", href: "/company", variant: "secondary" },
      ]}
    />
  ),
};

export const Secondary: Story<HeroProps> = {
  name: "Secondary (section hero)",
  source: `<Hero
  variant="secondary"
  eyebrow="Sample line"
  heading="Measure it, make it, support it."
  lead="A smaller-scale hero for a section landing page."
  actions={[{ label: "View lineup", href: "/lines/sample", variant: "primary" }]}
/>`,
  render: () => (
    <Hero
      variant="secondary"
      eyebrow="Sample line"
      heading="Measure it, make it, support it."
      lead="A smaller-scale hero for a section landing page."
      actions={[{ label: "View lineup", href: "/lines/sample", variant: "primary" }]}
    />
  ),
};
