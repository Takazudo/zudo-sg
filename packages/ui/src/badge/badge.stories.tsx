import type { StoryMeta, Story } from "../stories/types";
import { Badge } from "./badge";

const meta: StoryMeta = {
  title: "Badge",
  category: "Data Display",
  description: "Compact status/label pill in five tones and three fills (soft, solid, outline).",
  usage: `import { Badge } from "@zudo-sg/ui";

<Badge tone="success">Active</Badge>
<Badge tone="brand" variant="solid">New</Badge>`,
  order: 1,
};

export default meta;

const tones = ["neutral", "brand", "success", "danger", "accent"] as const;

export const Playground: Story = {
  name: "Playground",
  source: `<Badge tone="neutral" variant="soft">Badge</Badge>`,
  controls: [
    {
      type: "select",
      prop: "tone",
      label: "Tone",
      options: [...tones],
      defaultValue: "neutral",
    },
    {
      type: "select",
      prop: "variant",
      label: "Fill",
      options: ["soft", "solid", "outline"],
      defaultValue: "soft",
    },
    {
      type: "text",
      prop: "children",
      label: "Label",
      defaultValue: "Badge",
    },
  ],
  render: (args = {}) => (
    <div class="flex flex-wrap items-center gap-hsp-sm">
      <Badge
        tone={args.tone as (typeof tones)[number]}
        variant={args.variant as "soft" | "solid" | "outline"}
      >
        {args.children as string}
      </Badge>
    </div>
  ),
};

export const Soft: Story = {
  name: "Soft",
  source: `<Badge tone="neutral">neutral</Badge>
<Badge tone="brand">brand</Badge>
<Badge tone="success">success</Badge>
<Badge tone="danger">danger</Badge>
<Badge tone="accent">accent</Badge>`,
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-sm">
      {tones.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const Solid: Story = {
  name: "Solid",
  source: `<Badge tone="brand" variant="solid">brand</Badge>
<Badge tone="success" variant="solid">success</Badge>
<Badge tone="danger" variant="solid">danger</Badge>`,
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-sm">
      {tones.map((tone) => (
        <Badge key={tone} tone={tone} variant="solid">
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const Outline: Story = {
  name: "Outline",
  source: `<Badge tone="brand" variant="outline">brand</Badge>
<Badge tone="success" variant="outline">success</Badge>
<Badge tone="danger" variant="outline">danger</Badge>`,
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-sm">
      {tones.map((tone) => (
        <Badge key={tone} tone={tone} variant="outline">
          {tone}
        </Badge>
      ))}
    </div>
  ),
};
