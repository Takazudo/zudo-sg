import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
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
  // Leaf: `actions` (an array of {label,href,variant}) is JSON-safe as a
  // default, but has no field kind of its own (not a scalar) — it ships a
  // fixed default and stays inspector-only, same as every other prop here.
  composer: defineComposer<HeroProps>({
    componentId: "ui.hero",
    version: 1,
    component: Hero,
    source: {
      module: "@zudo-sg/ui/src/shared/hero/hero",
      exportKind: "named",
      exportName: "Hero",
    },
    defaults: {
      eyebrow: "Welcome",
      heading: "Build things that last",
      lead: "A sample lead paragraph.",
      variant: "primary",
      actions: [{ label: "Get started", href: "#", variant: "primary" }],
    },
    fields: [
      { kind: "text", prop: "eyebrow", label: "Eyebrow" },
      { kind: "text", prop: "heading", label: "Heading" },
      { kind: "text", prop: "lead", label: "Lead" },
      { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
    ],
  }),
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
