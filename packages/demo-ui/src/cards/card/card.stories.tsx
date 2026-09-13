import type { StoryMeta, Story } from "../../stories/types";
import { Card, type CardProps } from "./card";

const meta: StoryMeta = {
  title: "Card",
  category: "Data Display",
  description:
    "Flat surface container with a border and rounded corners, in three variants and three padding sizes.",
  usage: `import { Card } from "@zudo-sg/ui/src/cards/card/card";

<Card title="Card heading">Body copy.</Card>`,
};

export default meta;

const Lorem = () => (
  <p>
    A sample card component. Flat, white/light-gray surfaces with an accent color, using a border
    rather than a shadow to separate layers.
  </p>
);

export const Default: Story<CardProps> = {
  name: "Default (variant=default, padding=md, with title)",
  source: `<Card title="Card heading">
  <p>Body copy.</p>
</Card>`,
  render: () => (
    <div style={{ maxWidth: "420px" }}>
      <Card title="Card heading">
        <Lorem />
      </Card>
    </div>
  ),
};

export const Variants: Story<CardProps> = {
  name: "Variants (default / muted / accent)",
  source: `<Card variant="default" title="default — bg + border">…</Card>
<Card variant="muted" title="muted — surface tint">…</Card>
<Card variant="accent" title="accent — top accent rule">…</Card>`,
  render: () => (
    <div class="flex flex-col gap-y-vsp-md" style={{ maxWidth: "420px" }}>
      <Card title="default — bg + border" variant="default">
        <Lorem />
      </Card>
      <Card title="muted — surface tint" variant="muted">
        <Lorem />
      </Card>
      <Card title="accent — top accent rule" variant="accent">
        <Lorem />
      </Card>
    </div>
  ),
};

export const Paddings: Story<CardProps> = {
  name: "Paddings (sm / md / lg)",
  source: `<Card padding="sm" title="padding = sm">…</Card>
<Card padding="md" title="padding = md">…</Card>
<Card padding="lg" title="padding = lg">…</Card>`,
  render: () => (
    <div class="flex flex-col gap-y-vsp-md" style={{ maxWidth: "420px" }}>
      <Card title="padding = sm" padding="sm">
        <Lorem />
      </Card>
      <Card title="padding = md" padding="md">
        <Lorem />
      </Card>
      <Card title="padding = lg" padding="lg">
        <Lorem />
      </Card>
    </div>
  ),
};

export const BodyOnly: Story<CardProps> = {
  name: "Explicit Card.Title (no title prop)",
  source: `<Card>
  <Card.Title>Explicit Card.Title</Card.Title>
  <p>Body copy.</p>
</Card>`,
  render: () => (
    <div style={{ maxWidth: "420px" }}>
      <Card>
        <Card.Title>Explicit Card.Title</Card.Title>
        <Lorem />
      </Card>
    </div>
  ),
};
