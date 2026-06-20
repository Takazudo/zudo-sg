"use client";

// Shared `<dialog>` lifecycle for the enlarge islands (image-enlarge,
// mermaid-enlarge). Both render a native `showModal()` dialog whose open/close
// must stay in sync with island state, must fall back to state when closed
// natively (Escape / the `cancel`→`close` sequence), and must defensively
// close on a ClientRouter SPA swap — a still-open showModal() dialog can lose
// top-layer promotion when the page body is swapped.
//
// The backdrop-click behavior stays in each component: image-enlarge hit-tests
// the dialog's bounding rect, mermaid-enlarge compares `e.target === dialog`.

import { useEffect, useRef } from "preact/compat";
import type { RefObject } from "preact/compat";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";

/**
 * Drive a native modal `<dialog>` from boolean state.
 *
 * @param isOpen Whether the dialog should be shown. `showModal()`/`close()` are
 *   called to reconcile the element with this flag.
 * @param onClose Invoked when the dialog closes outside of `isOpen` going false
 *   — i.e. a native close (Escape, the close event) or an SPA navigation while
 *   open. Use it to reset the owning state back to its closed value.
 * @returns A ref to attach to the `<dialog>` element.
 */
export function useModalDialog(
  isOpen: boolean,
  onClose: () => void,
): { dialogRef: RefObject<HTMLDialogElement> } {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keep `onClose` current without re-registering the listeners below.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reconcile the element's open/closed state with `isOpen`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native close (Escape fires `cancel` then `close`; the backdrop/close
  // buttons call `dialog.close()` directly) → sync state back to closed.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose(): void {
      onCloseRef.current();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // SPA-swap guard: close (and reset) if still open when ClientRouter swaps.
  useEffect(() => {
    function handleAfterSwap(): void {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      onCloseRef.current();
    }
    document.addEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
    return () => document.removeEventListener(AFTER_NAVIGATE_EVENT, handleAfterSwap);
  }, []);

  return { dialogRef };
}
