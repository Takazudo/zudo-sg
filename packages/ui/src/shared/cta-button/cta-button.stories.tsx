import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { CtaButton, type CtaButtonProps } from "./cta-button";

const meta: StoryMeta = {
  title: "CtaButton",
  category: "Actions",
  description: "Accent-filled or outlined call-to-action link, with an optional trailing arrow.",
  usage: `import { CtaButton } from "@zudo-sg/ui/src/shared/cta-button/cta-button";

<CtaButton href="/products" variant="primary">Browse products</CtaButton>`,
  // Leaf: `children` is scalar label text (never a nested slot). See
  // STORIES.md §10 for the canonical worked example this mirrors.
  composer: defineComposer<CtaButtonProps>({
    componentId: "ui.cta-button",
    version: 1,
    component: CtaButton,
    source: {
      module: "@zudo-sg/ui/src/shared/cta-button/cta-button",
      exportKind: "named",
      exportName: "CtaButton",
    },
    defaults: { href: "/products", variant: "primary", arrow: true, children: "Browse products" },
    fields: [
      { kind: "text", prop: "href", label: "Link" },
      { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
      { kind: "boolean", prop: "arrow", label: "Arrow" },
      { kind: "text", prop: "children", label: "Label", inlineEdit: { multiline: false } },
    ],
    adapters: {
      // Trusted, non-serializable. Resolves the editable text node for
      // inline editing (CtaButton renders a trailing arrow, so a prop flag
      // alone can't target the label). Runtime-registry side only.
      inlineEditor: { field: "children", resolveElement: (root) => root },
    },
  }),
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
