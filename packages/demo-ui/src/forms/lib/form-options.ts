import type { SelectOption } from "../select/select";

/**
 * Single source for each form's `<Select>` options AND its enhancer label
 * dictionary — contact-form-enhancer.tsx / recruit-form-enhancer.tsx read the
 * `*_LABELS` maps to translate a raw field value into the review-panel label,
 * so a form and its enhancer can't drift apart on what a value means.
 */

/** Inquiry purpose (ContactForm). */
export const PURPOSE_OPTIONS: SelectOption[] = [
  { value: "product", label: "Product inquiry" },
  { value: "recruit", label: "Recruiting inquiry" },
  { value: "other", label: "Other (IR, press, etc.)" },
];

/** purpose value -> review-panel label, derived from PURPOSE_OPTIONS. */
export const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((o) => [o.value, o.label]),
);

/** Recruiting category (RecruitEntryForm). */
export const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "new-graduate", label: "New graduate" },
  { value: "career", label: "Career (mid-career)" },
];

/** category value -> review-panel label, derived from CATEGORY_OPTIONS. */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

/** Desired job (RecruitEntryForm). */
export const JOB_OPTIONS: SelectOption[] = [
  { value: "sales", label: "Sales" },
  { value: "engineer", label: "Engineer (FAE / FSE)" },
  { value: "research", label: "Research" },
  { value: "corporate", label: "Corporate (finance, HR, legal, etc.)" },
  { value: "undecided", label: "Not yet decided / would like to discuss" },
];

/** job value -> review-panel label, derived from JOB_OPTIONS. */
export const JOB_LABELS: Record<string, string> = Object.fromEntries(
  JOB_OPTIONS.map((o) => [o.value, o.label]),
);
