import type { StoryMeta, Story } from "../stories/types";
import { Card, CardTitle, CardBody, CardFooter } from "./card";
import { Badge } from "../badge/badge";
import { Link } from "../link/link";

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

export const Playground: Story = {
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
  ],
  render: (args = {}) => (
    <div class="max-w-[24rem]">
      <Card variant={args.variant as "outlined" | "elevated" | "filled"}>
        <CardTitle>{args.title as string}</CardTitle>
        <CardBody>{args.body as string}</CardBody>
      </Card>
    </div>
  ),
};

export const Variants: Story = {
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

export const WithFooter: Story = {
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

export const Linked: Story = {
  name: "Linked (whole card)",
  source: `<Card href="/articles/tokens" variant="outlined">
  <Badge tone="brand">Guide</Badge>
  <CardTitle>Designing with tight tokens</CardTitle>
  <CardBody>How a constrained token set keeps a UI coherent as it grows.</CardBody>
</Card>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Card href="/articles/tokens" variant="outlined">
        <Badge tone="brand">Guide</Badge>
        <CardTitle>Designing with tight tokens</CardTitle>
        <CardBody>How a constrained token set keeps a UI coherent as it grows.</CardBody>
      </Card>
    </div>
  ),
};
