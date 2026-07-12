"use client";

/**
 * RecruitFormEnhancer — client island driving RecruitEntryForm's input ->
 * confirm -> complete flow. Same shape as ContactFormEnhancer (see its header
 * comment) — renders nothing, delegates DOM wiring to the shared
 * `createFormEnhancer` factory, and is mounted by the consuming app (not
 * wrapped in `<Island>` here — @zudo-sg/ui takes no zfb dependency).
 *
 * No submit-adapter prop: unlike ContactFormEnhancer, this form has no async
 * variant in this batch — "Submit this entry" always transitions straight to
 * the complete panel (the factory's default, no-network behavior).
 */
import { useEffect } from "preact/hooks";
import { createFormEnhancer } from "../lib/create-form-enhancer";
import { CATEGORY_LABELS, JOB_LABELS } from "../lib/form-options";

const enhance = createFormEnhancer("recruit", {
  category: CATEGORY_LABELS,
  job: JOB_LABELS,
});

export default function RecruitFormEnhancer() {
  useEffect(() => {
    const dispose = enhance();
    return dispose;
  }, []);
  return null;
}
