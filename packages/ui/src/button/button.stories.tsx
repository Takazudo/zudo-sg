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

export const Playground: Story = {
  name: "Playground",
  source: `<Button variant="primary" size="md">Click me</Button>`,
  controls: [
    {
      type: "select",
      prop: "variant",
      label: "Variant",
      options: ["primary", "secondary", "ghost"],
      defaultValue: "primary",
    },
    {
      type: "select",
      prop: "size",
      label: "Size",
      options: ["sm", "md", "lg"],
      defaultValue: "md",
    },
    {
      type: "boolean",
      prop: "disabled",
      label: "Disabled",
      defaultValue: false,
    },
    {
      type: "boolean",
      prop: "block",
      label: "Block (full width)",
      defaultValue: false,
    },
    {
      type: "text",
      prop: "children",
      label: "Label",
      defaultValue: "Click me",
    },
  ],
  render: (args = {}) => (
    <div class="flex flex-wrap items-center gap-hsp-md">
      <Button
        variant={args.variant as "primary" | "secondary" | "ghost"}
        size={args.size as "sm" | "md" | "lg"}
        disabled={args.disabled as boolean}
        block={args.block as boolean}
      >
        {args.children as string}
      </Button>
    </div>
  ),
};

export const Variants: Story = {
  name: "Variants",
  source: `<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>`,
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
  source: `<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>`,
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
  source: `<Button href="/docs" variant="primary">Read the docs</Button>
<Button href="https://example.com" variant="secondary">External</Button>`,
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
  source: `<Button disabled>Primary</Button>
<Button variant="secondary" disabled>Secondary</Button>
<Button variant="ghost" disabled>Ghost</Button>`,
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
  source: `<Button block>Full width</Button>
<Button variant="secondary" block>Full width</Button>`,
  render: () => (
    <div class="flex max-w-[20rem] flex-col gap-vsp-xs">
      <Button block>Full width</Button>
      <Button variant="secondary" block>
        Full width
      </Button>
    </div>
  ),
};
