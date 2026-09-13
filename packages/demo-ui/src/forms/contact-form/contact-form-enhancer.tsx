"use client";

/**
 * ContactFormEnhancer — client island driving ContactForm's input -> confirm
 * -> complete flow (see contact-form.tsx's header comment for the full DOM
 * contract and the "consumer mounts the island" note — @zudo-sg/ui takes no
 * zfb dependency, so this file is NOT wrapped in `<Island>` itself).
 *
 * Renders nothing (`null`) — it only attaches behavior to the SSR markup
 * ContactForm already produced. Delegates the actual DOM wiring to the shared
 * `createFormEnhancer` factory (see its header comment for the click/submit
 * contract and the submit-adapter behavior).
 */
import { useEffect } from "preact/hooks";
import { createFormEnhancer, type FormSubmitAdapter } from "../lib/create-form-enhancer";
import { PURPOSE_LABELS } from "../lib/form-options";

const enhance = createFormEnhancer("contact", { purpose: PURPOSE_LABELS });

export type ContactFormEnhancerProps = {
  /**
   * Injectable async submit adapter. Omitted -> "Send" transitions straight
   * to the complete panel with no network (the default, local-only
   * behavior). Provided -> "Send" awaits it with the collected field values;
   * a rejection keeps the confirm panel open and renders the error's message
   * in ContactForm's `[data-contact-error]` slot, the same
   * stay-open-on-failure contract as @zudo-sg/ui's Dialog `onSubmit`. This is
   * the seam a later MSW-backed demo wires a real (mocked) request through —
   * no MSW or fetch usage belongs in this file.
   */
  onSubmit?: FormSubmitAdapter;
};

export default function ContactFormEnhancer({ onSubmit }: ContactFormEnhancerProps = {}) {
  useEffect(() => {
    const dispose = enhance(onSubmit);
    return dispose;
  }, [onSubmit]);
  return null;
}
