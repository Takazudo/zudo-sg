import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { cx } from "../lib/cx";
import { Button } from "../button/button";

// Per-instance title id from a module-scoped counter — NOT preact's useId().
// @zudo-sg/ui is consumed from source and can be rendered under a consumer's
// own nested preact copy, where a hook like useId runs against a preact
// instance whose dispatcher is unset during that consumer's SSR build (see the
// same note in form.tsx). A plain counter is instance-agnostic; useRef pins the
// value for the life of the instance.
let dialogSeq = 0;
function nextDialogId(): string {
  dialogSeq += 1;
  return `zui-dialog-${dialogSeq}`;
}

// First-focus target selector: natively focusable, non-disabled elements.
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  /** Controlled visibility. When false, the dialog renders nothing. */
  open: boolean;
  /** Accessible name — rendered as the heading and wired via `aria-labelledby`. */
  title: ComponentChildren;
  /** Invoked on Escape, backdrop click, the header close button, or Cancel. */
  onClose: () => void;
  /** Dialog body. */
  children?: ComponentChildren;
  /**
   * Injectable async submit handler. When provided, a primary action button is
   * shown; clicking it awaits this handler. While it is pending the actions are
   * disabled (busy). On rejection the error message is shown and the dialog
   * STAYS OPEN so the user can retry. Success is left to the caller (the
   * controlled `open` prop) — the handler typically calls `onClose`.
   */
  onSubmit?: () => void | Promise<void>;
  /** Primary button label. Default "Submit". */
  submitLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Close when the backdrop (outside the panel) is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /**
   * Controlled busy flag, OR'd with the internal in-flight state so a story (or
   * caller) can show the busy state with a static prop. Disables the actions.
   */
  busy?: boolean;
  /**
   * Controlled error message, falling back to the internal submit error, so a
   * story (or caller) can show the error state with a static prop.
   */
  error?: ComponentChildren;
  class?: string;
}

/**
 * Modal dialog with a controlled `open` state. Closes on Escape, backdrop click
 * (configurable), the header close button, and Cancel. Manages focus — moving
 * it into the dialog on open and restoring it to the trigger on close — and
 * drives an injectable async submit flow with a busy state and error recovery.
 * Styled entirely with semantic tokens, so it is dark-correct via the token
 * system. Requires runtime JS; render it client-side (it is not SSR-only).
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  onSubmit,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  closeOnBackdrop = true,
  busy,
  error,
  class: cls,
}: DialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ComponentChildren>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleIdRef = useRef<string>("");
  if (!titleIdRef.current) titleIdRef.current = nextDialogId();
  const titleId = titleIdRef.current;

  const isBusy = Boolean(busy) || submitting;
  const shownError = error ?? submitError;

  // Focus management + per-open reset. On open: clear any transient submit state
  // so every open session starts clean — a late rejection can set submitError
  // AFTER a close while the dialog stays mounted (the demo keeps <Dialog> mounted
  // and only toggles `open`), so clearing on close alone would leak a stale error
  // into the next open. Then remember the trigger and move focus into the panel.
  // The cleanup restores focus to the trigger, covering BOTH a normal close
  // (open→false) and an unmount-while-open, and runs exactly once per open
  // session so focus is never double-restored.
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setSubmitting(false);
    const trigger = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    }
    return () => {
      // Guard isConnected: a trigger removed while the dialog was open must not
      // steal focus to a detached node (or throw) — skip the restore instead.
      if (trigger?.isConnected) trigger.focus?.();
    };
  }, [open]);

  // Key handling while open. Escape closes UNLESS busy — a submit in flight must
  // not be interrupted, matching the disabled Cancel/Submit buttons. Tab and
  // Shift+Tab are trapped inside the panel so keyboard focus cannot escape to the
  // background behind the scrim of this aria-modal dialog.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        if (!isBusy) onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        // Nothing focusable (e.g. every action disabled while busy) — pin focus
        // to the panel instead of letting Tab escape to the background.
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isBusy]);

  if (!open) return null;

  async function handleSubmit(): Promise<void> {
    if (!onSubmit || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit();
    } catch (err) {
      // Failure recovery: surface the error, keep the dialog open, allow retry.
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Fixed full-viewport scrim. The scrim color is a fixed translucent black in
    // both light and dark schemes (a light-mode ink scrim would invert to a pale
    // wash in dark mode); z-[50] matches the host's modal-backdrop tier without
    // binding to a consumer-specific z-index token (see site-header.tsx).
    <div
      class="fixed inset-0 z-[50] flex items-center justify-center p-hsp-lg bg-[rgb(0_0_0/0.5)]"
      onClick={(e) => {
        // A submit in flight must not be closable — same busy contract as the
        // disabled action buttons and the guarded Escape handler.
        if (isBusy) return;
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isBusy || undefined}
        tabIndex={-1}
        class={cx(
          "flex w-full max-w-[32rem] flex-col gap-vsp-md rounded-lg border border-line " +
            "bg-surface p-hsp-xl shadow-overlay outline-none",
          cls,
        )}
      >
        <div class="flex items-start justify-between gap-hsp-md">
          <h2 id={titleId} class="text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isBusy}
            class={
              "shrink-0 rounded-md p-hsp-2xs text-ink-mute outline-none transition-colors " +
              "hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
              "disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {children != null && <div class="text-sm text-ink-soft">{children}</div>}

        {shownError && (
          <p role="alert" class="text-sm text-danger">
            {shownError}
          </p>
        )}

        <div class="mt-vsp-2xs flex items-center justify-end gap-hsp-md">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            {cancelLabel}
          </Button>
          {onSubmit && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isBusy}
              aria-busy={isBusy || undefined}
            >
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
