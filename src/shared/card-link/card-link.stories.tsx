import type { StoryMeta, Story } from "../../stories/types";
import { CardLink, ViewAllLink, type CardLinkProps, type ViewAllLinkProps } from "./card-link";
import { AutoGrid } from "../auto-grid/auto-grid";
import { Card } from "../../cards/card/card";

const meta: StoryMeta = {
  title: "CardLink",
  category: "Navigation",
  description:
    "Full-bleed card link wrapper, plus the ViewAllLink accent text link used to point at a listing page.",
  usage: `import { CardLink, ViewAllLink } from "@zudo-sg/ui/src/shared/card-link/card-link";

<CardLink href="/products"><Card>…</Card></CardLink>
<ViewAllLink href="/news">View all news</ViewAllLink>`,
};

export default meta;

export const Default: Story<CardLinkProps> = {
  name: "Card wrapped as a link",
  source: `<CardLink href="/products">
  <Card class="h-full transition-colors group-hover:border-accent">
    <Card.Title class="transition-colors group-hover:text-accent">Products</Card.Title>
    <p class="text-small text-fg">The whole card is clickable.</p>
  </Card>
</CardLink>`,
  render: () => (
    <AutoGrid>
      {["Products", "Company", "Investors"].map((x) => (
        <CardLink key={x} href="/products">
          <Card class="h-full transition-colors group-hover:border-accent">
            <Card.Title class="transition-colors group-hover:text-accent">{x}</Card.Title>
            <p class="text-small leading-relaxed text-fg">The whole card is clickable.</p>
          </Card>
        </CardLink>
      ))}
    </AutoGrid>
  ),
};

export const ViewAll: Story<ViewAllLinkProps> = {
  name: "ViewAllLink",
  source: `<ViewAllLink href="/news">View all news</ViewAllLink>`,
  render: () => <ViewAllLink href="/news">View all news</ViewAllLink>,
};
