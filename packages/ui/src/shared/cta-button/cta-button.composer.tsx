import { defineComponent } from "@zudo-composer/component-contract";
import { CtaButton, type CtaButtonProps } from "./cta-button";

export const ctaButtonDisplay = {
  title: "CtaButton",
  category: "Actions",
  description: "Accent-filled or outlined call-to-action link, with an optional trailing arrow.",
} as const;

export const ctaButtonComposer = defineComponent<CtaButtonProps>()(CtaButton, {
  id: "ui.cta-button",
  schemaVersion: 1,
  ...ctaButtonDisplay,
  source: { module: "@zudo-sg/ui", exportKind: "named", exportName: "CtaButton" },
  defaults: { href: "/products", variant: "primary", arrow: true, children: "Browse products" },
  fields: [
    { kind: "text", prop: "href", label: "Link", required: true },
    { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
    { kind: "boolean", prop: "arrow", label: "Arrow" },
    { kind: "text", prop: "children", label: "Label", inlineEdit: { multiline: false } },
  ],
  adapters: {
    inlineEditor: {
      field: "children",
      resolveElement: (root: HTMLElement) => root.querySelector<HTMLElement>("[data-cta-label]") ?? root,
    },
  },
});
