// Stable component/slot ids used by the native Composition sample.
//
// These are OPAQUE, persisted document keys — deliberately not derived from any
// title/prop/path. They are exported so the sample document and its tests
// reference one source of truth.
//
// ── Reconciled against the real #246 cohort ──────────────────────────────────
// The parallel #246 sibling has landed the real production component cohort
// under `packages/ui`. These ids/slot-ids are copied VERBATIM from that
// cohort's registered `componentId`/slot `id` strings so this sample stays
// fully available (no opaque nodes) once both branches merge:
//
//   ui.split-layout   slot "left"  -> prop "left"  (single)
//                     slot "right" -> prop "right" (many)
//   ui.stack          slot "content" -> prop "children" (many, default slot)
//   ui.section-heading  leaf, no slots (its "intro" is a scalar text field)
//   ui.prose-p          leaf, no slots
//   ui.cta-button        leaf, no slots
//
// This file references ids as STRINGS only — it imports no components (that
// stays a wave-5 integration concern). If the real cohort's ids/slot-ids drift
// after this reconciliation, wave-5 integration (#251) is the fallback owner.

export const SAMPLE_COMPONENT_VERSION = 1;

export const SAMPLE_COMPONENT_IDS = {
  splitLayout: "ui.split-layout",
  stack: "ui.stack",
  sectionHeading: "ui.section-heading",
  prose: "ui.prose-p",
  ctaButton: "ui.cta-button",
} as const;

export const SAMPLE_SLOT_IDS = {
  /** SplitLayout named slot — single child (the section header). */
  splitLeft: "left",
  /** SplitLayout named slot — many children (the body column). */
  splitRight: "right",
  /** Stack default slot — persisted slot id "content", renders into the `children` prop. */
  stackChildren: "content",
} as const;
