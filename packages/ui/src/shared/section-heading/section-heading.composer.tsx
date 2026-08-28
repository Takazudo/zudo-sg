import { defineComponent } from "@zudo-composer/component-contract";
import { SectionHeading, type SectionHeadingProps } from "./section-heading";

export const sectionHeadingDisplay = {
  title: "SectionHeading",
  category: "Content",
  description: "Section header block: optional eyebrow, heading, and an optional intro paragraph.",
} as const;

export const sectionHeadingComposer = defineComponent<
  SectionHeadingProps,
  typeof SectionHeading,
  unknown,
  HTMLElement
>({
  id: "ui.section-heading",
  schemaVersion: 1,
  ...sectionHeadingDisplay,
  source: { module: "@zudo-sg/ui", exportKind: "named", exportName: "SectionHeading" },
  defaults: {
    eyebrow: "About",
    heading: "Our approach",
    intro: "A short supporting sentence.",
    as: "h2",
  },
  fields: [
    { kind: "text", prop: "eyebrow", label: "Eyebrow" },
    { kind: "text", prop: "heading", label: "Heading", required: true, inlineEdit: {} },
    { kind: "text", prop: "intro", label: "Intro" },
    { kind: "select", prop: "as", label: "Heading level", options: ["h1", "h2"] },
  ],
  component: SectionHeading,
  adapters: {
    inlineEditor: {
      field: "heading",
      resolveElement: (root) => root.querySelector<HTMLHeadingElement>("h1, h2"),
    },
  },
});
