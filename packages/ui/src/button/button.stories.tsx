import type { StoryMeta, Story } from "../stories/types";
import { Button } from "./button";

const meta: StoryMeta = {
  title: "Button",
  category: "Actions",
  description:
    "Primary action control with three variants and three sizes. Renders <button>, or <a> when href is set.",
  usage: `import { Button } from "@zudo-sg/ui";

<Button variant="primary" onClick={save}>Save</Button>
<Button variant="secondary" href="/docs">Docs</Button>`,
  order: 1,
};

export default meta;

export const Variants: Story = {
  name: "Variants",
  source: `<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>`,
  controls: [
    {
      type: "select",
      prop: "variant",
      label: "Variant",
      options: ["primary", "secondary", "ghost"],
      defaultValue: "primary",
    },
  ],
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-md">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const Sizes: Story = {
  name: "Sizes",
  controls: [
    {
      type: "select",
      prop: "size",
      label: "Size",
      options: ["sm", "md", "lg"],
      defaultValue: "md",
    },
  ],
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-md">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const AsLink: Story = {
  name: "As link",
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-md">
      <Button href="/docs" variant="primary">
        Read the docs
      </Button>
      <Button href="https://example.com" variant="secondary">
        External
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  name: "Disabled",
  render: () => (
    <div class="flex flex-wrap items-center gap-hsp-md">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
    </div>
  ),
};

export const Block: Story = {
  name: "Block",
  render: () => (
    <div class="flex max-w-[20rem] flex-col gap-vsp-xs">
      <Button block>Full width</Button>
      <Button variant="secondary" block>
        Full width
      </Button>
    </div>
  ),
};
