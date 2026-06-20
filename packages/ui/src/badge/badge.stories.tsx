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

export const Soft: Story = {
  name: "Soft",
  controls: [
    {
      type: "select",
      prop: "tone",
      label: "Tone",
      options: [...tones],
      defaultValue: "neutral",
    },
  ],
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
