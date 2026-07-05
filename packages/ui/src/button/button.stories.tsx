import type { StoryMeta, Story } from "../stories/types";
import { Button, type ButtonProps } from "./button";

// The Playground always renders a plain <button> (no `href` control), so its
// controls are checked against the button branch of the polymorphic
// ButtonProps union — the anchor branch has no native `disabled` attribute,
// which would otherwise drop "disabled" from `keyof ButtonProps`.
type ButtonPlaygroundProps = Extract<ButtonProps, { href?: undefined }>;

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

export const Playground: Story<ButtonPlaygroundProps> = {
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
        variant={args.variant}
        size={args.size}
        disabled={args.disabled}
        block={args.block}
      >
        {args.children}
      </Button>
    </div>
  ),
};

export const Variants: Story<ButtonProps> = {
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

export const Sizes: Story<ButtonProps> = {
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

export const AsLink: Story<ButtonProps> = {
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

export const Disabled: Story<ButtonProps> = {
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

export const Block: Story<ButtonProps> = {
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
