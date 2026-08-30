import { defineComponent } from "@zudo-composer/component-contract";
import { Hero, type HeroProps } from "./hero";

export const heroDisplay = {
  title: "Hero",
  category: "Content",
  description:
    "First-view hero band: eyebrow + display heading + lead + CTA row over a soft accent-tinted background.",
} as const;

export const heroComposer = defineComponent<HeroProps, typeof Hero>({
  id: "ui.hero",
  schemaVersion: 1,
  ...heroDisplay,
  source: { module: "@zudo-sg/ui", exportKind: "named", exportName: "Hero" },
  defaults: {
    eyebrow: "Welcome",
    heading: "Build things that last",
    lead: "A sample lead paragraph.",
    variant: "primary",
    actions: [{ label: "Get started", href: "#", variant: "primary" }],
  },
  staticProps: [
    {
      prop: "actions",
      reason: "Structured CTA data remains application-owned until recursive value schemas are available.",
    },
  ],
  fields: [
    { kind: "text", prop: "eyebrow", label: "Eyebrow" },
    { kind: "text", prop: "heading", label: "Heading" },
    { kind: "text", prop: "lead", label: "Lead" },
    { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
  ],
  component: Hero,
});
