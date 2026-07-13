/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Generic inline confirm bar: a message plus Cancel/Confirm pair, extracted
// from #250's tree-row `SubtreeRemovalConfirm` (issue #269, folding in #260)
// so any destructive action in the composer can reuse the SAME confirm
// mechanism instead of inventing a second one. Initial focus always lands on
// Cancel — the SAFE action — unifying every entry point that renders this
// (tree row inline, node context-menu Delete, toolbar Reset); Escape cancels.
//
// Reuses `SubtreeRemovalConfirm`'s original `.sg-composer-tree-confirm*`
// classes verbatim (same precedent as the context menu's Delete confirmation
// in styles.css) rather than adding a parallel style block — visual polish
// for non-tree call sites lands in a later wave.

import { useEffect, useRef } from "preact/hooks";
import type { JSX } from "preact";

export interface InlineConfirmProps {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Accessible name for the `role="group"` wrapper. */
  ariaLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function InlineConfirm({
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  ariaLabel,
  onCancel,
  onConfirm,
}: InlineConfirmProps): JSX.Element {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <div class="sg-composer-tree-confirm" role="group" aria-label={ariaLabel}>
      <span class="sg-composer-tree-confirm-text">{message}</span>
      <button
        ref={cancelButtonRef}
        type="button"
        class="sg-composer-tree-action"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        class="sg-composer-tree-action sg-composer-tree-action-danger"
        onClick={onConfirm}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
