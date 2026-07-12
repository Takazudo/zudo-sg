// Stable component/slot ids used by the native Composition sample.
//
// These are OPAQUE, persisted document keys — deliberately not derived from any
// title/prop/path. They mirror the epic's intended cohort (a `SplitLayout` with
// named `left`/`right` slots, a `Stack` with a default `children` slot, and a
// few representative leaves). They are exported so the sample document and its
// tests reference one source of truth.
//
// ── Wave-5 reconciliation note ───────────────────────────────────────────────
// The REAL component cohort (its exact `componentId`/slot `id` strings) is
// authored in parallel by #246 and does not exist on this branch. If those ids
// differ from the ones here, the sample's nodes will render as opaque until the
// wave-5 integration issue (#251) reconciles this file with the real manifest.
// This file references ids as STRINGS only — it imports no components.

export const SAMPLE_COMPONENT_VERSION = 1;

export const SAMPLE_COMPONENT_IDS = {
  splitLayout: "layout.split-layout",
  stack: "layout.stack",
  sectionHeading: "content.section-heading",
  prose: "content.prose",
  ctaButton: "action.cta-button",
} as const;

export const SAMPLE_SLOT_IDS = {
  /** SplitLayout named slot — single child (the section header). */
  splitLeft: "left",
  /** SplitLayout named slot — many children (the body column). */
  splitRight: "right",
  /** Stack default children slot. */
  stackChildren: "children",
} as const;
