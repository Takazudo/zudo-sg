import type { StoryMeta, Story } from "../stories/types";
import { Card, CardTitle, CardBody, CardFooter, type CardVariant } from "./card";
import { Badge } from "../badge/badge";
import { Link } from "../link/link";

// CardProps isn't exported (Card is consumed via its component signature
// elsewhere), so derive it from the function itself rather than widening the
// component's public surface just for story typing.
type CardProps = Parameters<typeof Card>[0];

// The Playground composes Card + CardTitle/CardBody/CardFooter into one scene,
// so its controls drive a scene-specific arg shape rather than Card's own
// props 1:1 — only `variant` maps onto a real CardProps key.
type CardPlaygroundProps = {
  variant: CardVariant;
  title: string;
  body: string;
  showFooter: boolean;
  footer: string;
};

const meta: StoryMeta = {
  title: "Card",
  category: "Layout",
  description: "Surface container with outlined / elevated / filled variants and Title/Body/Footer slots.",
  usage: `import { Card, CardTitle, CardBody, CardFooter } from "@zudo-sg/ui";

<Card variant="elevated">
  <CardTitle>Heading</CardTitle>
  <CardBody>Supporting copy.</CardBody>
</Card>`,
  order: 1,
};

export default meta;

export const Playground: Story<CardPlaygroundProps> = {
  name: "Playground",
  source: `<Card variant="outlined">
  <CardTitle>Card title</CardTitle>
  <CardBody>A card surface using the shared semantic tokens.</CardBody>
</Card>`,
  controls: [
    {
      type: "select",
      prop: "variant",
      label: "Variant",
      options: ["outlined", "elevated", "filled"],
      defaultValue: "outlined",
    },
    {
      type: "text",
      prop: "title",
      label: "Title",
      defaultValue: "Card title",
    },
    {
      type: "text",
      prop: "body",
      label: "Body",
      defaultValue: "A card surface using the shared semantic tokens.",
    },
    {
      type: "boolean",
      prop: "showFooter",
      label: "Show footer",
      defaultValue: false,
    },
    {
      type: "text",
      prop: "footer",
      label: "Footer text",
      defaultValue: "Footer content",
    },
  ],
  render: (args = {}) => (
    <div class="max-w-[24rem]">
      <Card variant={args.variant}>
        <CardTitle>{args.title}</CardTitle>
        <CardBody>{args.body}</CardBody>
        {args.showFooter && <CardFooter>{args.footer}</CardFooter>}
      </Card>
    </div>
  ),
};

export const Variants: Story<CardProps> = {
  name: "Variants",
  source: `<Card variant="outlined">
  <CardTitle>outlined</CardTitle>
  <CardBody>A card surface using the shared semantic tokens.</CardBody>
</Card>
<Card variant="elevated">…</Card>
<Card variant="filled">…</Card>`,
  render: () => (
    <div class="grid gap-hsp-lg sm:grid-cols-3">
      {(["outlined", "elevated", "filled"] as const).map((variant) => (
        <Card key={variant} variant={variant}>
          <CardTitle>{variant}</CardTitle>
          <CardBody>A {variant} card surface using the shared semantic tokens.</CardBody>
        </Card>
      ))}
    </div>
  ),
};

export const WithFooter: Story<CardProps> = {
  name: "With footer",
  source: `<Card variant="elevated">
  <div class="flex items-center justify-between gap-hsp-md">
    <CardTitle>Project dashboard</CardTitle>
    <Badge tone="success">Active</Badge>
  </div>
  <CardBody>Track build status, deploys, and errors…</CardBody>
  <CardFooter>
    <Link href="/dashboard" variant="standalone">Open dashboard</Link>
  </CardFooter>
</Card>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Card variant="elevated">
        <div class="flex items-center justify-between gap-hsp-md">
          <CardTitle>Project dashboard</CardTitle>
          <Badge tone="success">Active</Badge>
        </div>
        <CardBody>
          Track build status, deploys, and errors across every environment from a single view.
        </CardBody>
        <CardFooter>
          <Link href="/dashboard" variant="standalone">
            Open dashboard
          </Link>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const Linked: Story<CardProps> = {
  name: "Linked (whole card)",
  source: `<Card href="/docs/getting-started/token-panels" variant="outlined">
  <Badge tone="brand">Guide</Badge>
  <CardTitle>Designing with tight tokens</CardTitle>
  <CardBody>How a constrained token set keeps a UI coherent as it grows.</CardBody>
</Card>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Card href="/docs/getting-started/token-panels" variant="outlined">
        <Badge tone="brand">Guide</Badge>
        <CardTitle>Designing with tight tokens</CardTitle>
        <CardBody>How a constrained token set keeps a UI coherent as it grows.</CardBody>
      </Card>
    </div>
  ),
};
