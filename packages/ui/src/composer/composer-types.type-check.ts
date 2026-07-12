/**
 * Type-level examples for the Composer authoring contract.
 *
 * This file is TYPE-ONLY: it is compiled by `tsc --noEmit`
 * (`pnpm --filter @zudo-sg/ui typecheck`) but is NOT a runtime test (its name
 * is not `*.test.ts`, so vitest ignores it). Each `@ts-expect-error` asserts a
 * MISUSE fails to typecheck — if any of these ever compiled, the typecheck
 * would fail on the unused directive. Together they demonstrate the acceptance
 * criterion: "prop-key checking for defaults, fields, and slot `prop` mappings."
 */

import { defineComposer } from "./types";
import { CtaButton, type CtaButtonProps } from "../shared/cta-button/cta-button";
import { SectionHeading, type SectionHeadingProps } from "../shared/section-heading/section-heading";

// ── A fully valid definition typechecks against the component's real props ──
export const ctaButtonComposer = defineComposer<CtaButtonProps>({
  componentId: "ui.cta-button", // opaque, stable — NOT derived from title/slug
  version: 1,
  component: CtaButton,
  source: {
    module: "@zudo-sg/ui/src/shared/cta-button/cta-button",
    exportKind: "named",
    exportName: "CtaButton",
  },
  defaults: {
    href: "/products",
    variant: "primary", // narrowed to the "primary" | "secondary" union
    arrow: true,
    children: "Browse products",
  },
  fields: [
    { kind: "select", prop: "variant", label: "Variant", options: ["primary", "secondary"] },
    { kind: "boolean", prop: "arrow", label: "Arrow" },
    { kind: "text", prop: "children", label: "Label", inlineEdit: { multiline: false } },
  ],
  adapters: {
    inlineEditor: {
      field: "children",
      resolveElement: (root) => root,
    },
  },
});

// ── A container component with named structural slots ───────────────────────
export const sectionHeadingComposer = defineComposer<SectionHeadingProps>({
  componentId: "ui.section-heading",
  version: 1,
  component: SectionHeading,
  source: {
    module: "@zudo-sg/ui/src/shared/section-heading/section-heading",
    exportKind: "named",
    exportName: "SectionHeading",
  },
  defaults: { heading: "Our approach", eyebrow: "About" },
  fields: [
    { kind: "text", prop: "heading", label: "Heading", inlineEdit: {} },
    { kind: "text", prop: "eyebrow", label: "Eyebrow" },
  ],
  slots: [
    // `intro` is a real prop; the slot id "intro-slot" is an opaque persisted
    // key, deliberately NOT equal to the prop name to prove they are decoupled.
    { id: "intro-slot", prop: "intro", label: "Intro", cardinality: "single" },
  ],
});

// ── Negative: a default under a key that is not a real prop ──────────────────
defineComposer<CtaButtonProps>({
  componentId: "x",
  version: 1,
  component: CtaButton,
  source: { module: "m", exportKind: "named", exportName: "CtaButton" },
  defaults: {
    // @ts-expect-error — "notAProp" is not a key of CtaButtonProps
    notAProp: "x",
  },
});

// ── Negative: a default value outside the prop's own value type ──────────────
defineComposer<CtaButtonProps>({
  componentId: "x",
  version: 1,
  component: CtaButton,
  source: { module: "m", exportKind: "named", exportName: "CtaButton" },
  defaults: {
    // @ts-expect-error — "tertiary" is not in the "primary" | "secondary" union
    variant: "tertiary",
  },
});

// ── Negative: a select field option outside the prop's union ─────────────────
defineComposer<CtaButtonProps>({
  componentId: "x",
  version: 1,
  component: CtaButton,
  source: { module: "m", exportKind: "named", exportName: "CtaButton" },
  fields: [
    {
      kind: "select",
      prop: "variant",
      label: "Variant",
      // @ts-expect-error — "nope" is not an allowed value of `variant`
      options: ["nope"],
    },
  ],
});

// ── Negative: a slot `prop` that is not a real prop of the component ─────────
defineComposer<SectionHeadingProps>({
  componentId: "x",
  version: 1,
  component: SectionHeading,
  source: { module: "m", exportKind: "named", exportName: "SectionHeading" },
  slots: [
    {
      id: "ghost",
      // @ts-expect-error — "notAProp" is not a key of SectionHeadingProps
      prop: "notAProp",
      label: "Ghost",
      cardinality: "single",
    },
  ],
});

// ── Negative: a field `prop` that is not a real prop of the component ────────
defineComposer<CtaButtonProps>({
  componentId: "x",
  version: 1,
  component: CtaButton,
  source: { module: "m", exportKind: "named", exportName: "CtaButton" },
  fields: [
    // @ts-expect-error — "notAProp" is not a key of CtaButtonProps
    { kind: "text", prop: "notAProp", label: "Nope" },
  ],
});
