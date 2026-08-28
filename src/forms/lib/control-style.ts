/**
 * Shared base class for the form control primitives (Input / Textarea / Select).
 * Centralizing it here is what keeps the three controls visually identical —
 * surface + border + radius, and an accent border + outline on focus.
 */
export const CONTROL_BASE =
  "w-full rounded-md border border-border bg-bg " +
  "px-hsp-md py-vsp-xs " +
  "text-small text-fg " +
  "transition-colors " +
  "focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
