import type { StoryMeta, Story } from "../../stories/types";
import { LineHero, type LineHeroProps } from "./line-hero";

const meta: StoryMeta = {
  title: "LineHero",
  category: "Landing",
  description:
    "Shared hero for business-line landing pages, reused across every line with per-line copy. Pair with a `[data-line]` ancestor so its accent color follows that line's theme.",
  usage: `import { LineHero } from "@zudo-sg/ui/src/landing/line-hero/line-hero";

<LineHero
  eyebrow="Vacuum Solutions — example-brand.com"
  heading="Vacuum equipment you can rely on"
  lead="Gauges, pumps, and integrated systems, backed by hands-on engineering support."
  actions={[{ label: "View lineup", href: "/lines/vacuum/products", variant: "primary" }]}
/>`,
  order: 10,
};

export default meta;

export const Default: Story<LineHeroProps> = {
  name: "Default",
  render: () => (
    <LineHero
      eyebrow="Vacuum Solutions — example-brand.com"
      heading="Vacuum equipment you can rely on"
      lead="Gauges, pumps, and integrated systems, backed by hands-on engineering support."
      actions={[
        { label: "View lineup", href: "/lines/vacuum/products", variant: "primary" },
        { label: "Contact us", href: "/contact", variant: "secondary" },
      ]}
    />
  ),
};

export const Minimal: Story<LineHeroProps> = {
  name: "Minimal (no actions)",
  render: () => (
    <LineHero
      eyebrow="Business Line"
      heading="One line, one clear value proposition"
      lead="Eyebrow, heading, and lead are swapped per line's frontmatter — this shared primitive is reused across all five lines."
    />
  ),
};
