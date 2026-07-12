import type { StoryMeta, Story } from "../../stories/types";
import { CtaButton, type CtaButtonProps } from "./cta-button";

const meta: StoryMeta = {
  title: "CtaButton",
  category: "Actions",
  description: "Accent-filled or outlined call-to-action link, with an optional trailing arrow.",
  usage: `import { CtaButton } from "@zudo-sg/ui/src/shared/cta-button/cta-button";

<CtaButton href="/products" variant="primary">Browse products</CtaButton>`,
};

export default meta;

export const Playground: Story<CtaButtonProps> = {
  name: "Playground",
  source: `<CtaButton href="/products" variant="primary">Browse products</CtaButton>`,
  controls: [
    {
      type: "select",
      prop: "variant",
      label: "Variant",
      options: ["primary", "secondary"],
      defaultValue: "primary",
    },
    {
      type: "boolean",
      prop: "arrow",
      label: "Arrow",
      defaultValue: true,
    },
    {
      type: "text",
      prop: "children",
      label: "Label",
      defaultValue: "Browse products",
    },
  ],
  render: (args = {}) => (
    <CtaButton href="/products" variant={args.variant} arrow={args.arrow}>
      {args.children}
    </CtaButton>
  ),
};

export const Pair: Story<CtaButtonProps> = {
  name: "Primary + secondary pair",
  source: `<CtaButton href="/products" variant="primary">Browse products</CtaButton>
<CtaButton href="/company" variant="secondary">Company info</CtaButton>`,
  render: () => (
    <div class="flex flex-wrap gap-x-hsp-md gap-y-vsp-xs">
      <CtaButton href="/products" variant="primary">
        Browse products
      </CtaButton>
      <CtaButton href="/company" variant="secondary">
        Company info
      </CtaButton>
    </div>
  ),
};
