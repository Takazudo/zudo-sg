import type { StoryMeta, Story } from "../../stories/types";
import { LandingHero, type LandingHeroProps } from "./landing-hero";

const meta: StoryMeta = {
  title: "LandingHero",
  category: "Landing",
  description:
    "A page's main hero band — pins shared Hero to its largest heading scale for a top-level landing page.",
  usage: `import { LandingHero } from "@zudo-sg/ui/src/landing/landing-hero/landing-hero";

<LandingHero
  eyebrow="Sample Tagline"
  heading="Two industries, one company"
  lead="A demo positioning statement."
  actions={[{ label: "View products", href: "/products", variant: "primary" }]}
/>`,
  order: 1,
};

export default meta;

export const Default: Story<LandingHeroProps> = {
  name: "Default",
  source: `<LandingHero
  eyebrow="Sample Tagline"
  heading={<>Sample <span class="text-accent">×</span> Demo, combined</>}
  lead="A demo positioning statement describing what this fictional company does."
  actions={[
    { label: "View products", href: "/products", variant: "primary" },
    { label: "About us", href: "/company", variant: "secondary" },
  ]}
/>`,
  render: () => (
    <LandingHero
      eyebrow="Sample Tagline"
      heading={
        <>
          Sample <span class="text-accent">×</span> Demo, combined
        </>
      }
      lead="A demo positioning statement describing what this fictional company does."
      actions={[
        { label: "View products", href: "/products", variant: "primary" },
        { label: "About us", href: "/company", variant: "secondary" },
      ]}
    />
  ),
};

export const SingleAction: Story<LandingHeroProps> = {
  name: "Single action",
  render: () => (
    <LandingHero
      eyebrow="Sample Tagline"
      heading="A single call to action"
      lead="Sometimes a hero only needs one clear next step."
      actions={[{ label: "View products", href: "/products", variant: "primary" }]}
    />
  ),
};
