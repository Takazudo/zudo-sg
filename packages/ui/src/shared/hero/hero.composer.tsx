import { defineComponent, type AuthorFieldDefinition } from "@zudo-composer/component-contract";
import { Hero, type HeroProps } from "./hero";

export const heroDisplay = {
  title: "Hero",
  category: "Content",
  description:
    "First-view hero band: eyebrow + display heading + lead + CTA row over a soft accent-tinted background.",
} as const;

export const heroComposer = defineComponent<HeroProps>()(Hero, {
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
  fields: [
    { kind: "text", prop: "eyebrow", label: "Eyebrow" },
    { kind: "text", prop: "heading", label: "Heading" },
    { kind: "text", prop: "lead", label: "Lead" },
    { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
    {
      prop: "actions",
      label: "Actions",
      schema: {
        type: "array",
        items: {
          schema: {
            type: "object",
            fields: [
              {
                key: "label",
                label: "Label",
                required: true,
                schema: { type: "string" },
                editor: { kind: "text" },
              },
              {
                key: "href",
                label: "URL",
                required: true,
                schema: { type: "string" },
                editor: { kind: "text" },
              },
              {
                key: "variant",
                label: "Variant",
                schema: { type: "string", enum: ["primary", "secondary"] },
                editor: { kind: "select" },
              },
            ],
          },
          editor: { kind: "group" },
        },
      },
      editor: { kind: "list" },
    } satisfies AuthorFieldDefinition<HeroProps>,
  ],
});
