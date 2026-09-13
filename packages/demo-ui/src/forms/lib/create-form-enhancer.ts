/**
 * createFormEnhancer — shared island factory behind every *-form-enhancer.tsx.
 *
 * ContactForm and RecruitEntryForm share one input -> confirm -> complete
 * panel flow; only the DOM namespace (`ns`, e.g. "contact") and the
 * value -> label dictionary used to fill the confirm panel differ. This
 * factory returns the DOM-enhancement function once so neither form has to
 * duplicate it (see the DOM-hook contract below, which every ported
 * `*-form.tsx` must keep in sync with).
 *
 * DOM hooks (attribute namespace = `ns`):
 *   - root:            [data-{ns}-form]
 *   - input <form>:     [data-{ns}-form-el]
 *   - panels:          [data-{ns}-panel="input"|"confirm"|"complete"]
 *   - actions:         [data-{ns}-action="edit"|"send"|"reset"]
 *   - review slots:    [data-{ns}-review="<field name>"]   (inside the confirm panel)
 *   - error slot:      [data-{ns}-error]                    (inside the confirm panel; optional)
 *
 * Submit-adapter contract (see FormSubmitAdapter below): by default "send"
 * transitions straight to "complete" (no network — the reference behavior).
 * Passing a `submitAdapter` to the returned `enhance()` call makes "send"
 * await it instead: success still shows "complete"; a rejection keeps the
 * confirm panel open and writes the error's message into the `[data-{ns}-error]`
 * slot (if present), the same stay-open-on-failure contract as
 * @zudo-sg/ui's Dialog `onSubmit`. While the adapter is in flight every
 * `[data-{ns}-action]` button is disabled and the root gets `aria-busy`.
 */

/** Exported so tests can build a `Map<Panel, …>` fixture for `isConfirmVisible`. */
export type Panel = "input" | "confirm" | "complete";

/** Field values collected from the form's named controls, keyed by `name`. */
export type FormSubmitData = Record<string, string>;

/**
 * Injectable async submit adapter for a `*-form-enhancer`. Receives the
 * collected field values. A rejection surfaces `Error#message` (or the
 * stringified reason) in the confirm panel's `[data-{ns}-error]` slot.
 */
export type FormSubmitAdapter = (data: FormSubmitData) => Promise<void>;

/**
 * Submit guard: is the confirm panel currently visible? Exported (and kept
 * pure/DOM-shape-only) so it's directly unit-testable without booting the
 * full enhancer.
 *
 * `hidden` is typed `boolean | string` because `HTMLElement.hidden` widens to
 * `string | boolean` under TS 6.x's `hidden="until-found"` support — accepting
 * both keeps this callable from either a TS 5.9 or TS 6.x lib.dom.
 */
export function isConfirmVisible(panels: Map<Panel, { hidden: boolean | string }>): boolean {
  const confirm = panels.get("confirm");
  return !!confirm && !confirm.hidden;
}

/**
 * Builds the DOM-enhance function for one form namespace. Returns a function
 * that, when called (optionally with a `submitAdapter`), wires up every
 * `[data-{ns}-form]` root currently in the document and returns its cleanup.
 */
export function createFormEnhancer(
  ns: string,
  labelsByField: Record<string, Record<string, string>>,
): (submitAdapter?: FormSubmitAdapter) => () => void {
  return function enhance(submitAdapter?: FormSubmitAdapter): () => void {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(`[data-${ns}-form]`));
    if (roots.length === 0) return () => {};

    const cleanups: Array<() => void> = [];

    for (const root of roots) {
      const form = root.querySelector<HTMLFormElement>(`[data-${ns}-form-el]`);
      if (!form) continue;

      const panels = new Map<Panel, HTMLElement>();
      for (const name of ["input", "confirm", "complete"] as Panel[]) {
        const el = root.querySelector<HTMLElement>(`[data-${ns}-panel="${name}"]`);
        if (el) panels.set(name, el);
      }
      const errorEl = root.querySelector<HTMLElement>(`[data-${ns}-error]`);

      const setError = (message: string | null) => {
        if (!errorEl) return;
        errorEl.textContent = message ?? "";
        errorEl.hidden = !message;
      };

      const setBusy = (busy: boolean) => {
        for (const btn of Array.from(
          root.querySelectorAll<HTMLButtonElement>(`[data-${ns}-action]`),
        )) {
          btn.disabled = busy;
        }
        root.setAttribute("aria-busy", busy ? "true" : "false");
      };

      const show = (target: Panel) => {
        // Every deliberate panel switch clears a stale error from a prior
        // failed submit — otherwise re-entering "input" (or a later re-submit)
        // could show yesterday's error next to today's confirm panel.
        setError(null);
        for (const [name, el] of panels) {
          el.hidden = name !== target;
        }
        // Move focus to the destination panel's heading so the transition is
        // announced to screen readers and keyboard users.
        const heading = panels.get(target)?.querySelector<HTMLElement>("h2, h3");
        if (heading) {
          heading.setAttribute("tabindex", "-1");
          heading.focus();
        }
      };

      const fieldValue = (name: string): string => {
        const el = form.elements.namedItem(name);
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement
        ) {
          return el.value.trim();
        }
        return "";
      };

      const collectFormData = (): FormSubmitData => {
        const data: FormSubmitData = {};
        for (const el of Array.from(form.elements)) {
          if (
            (el instanceof HTMLInputElement ||
              el instanceof HTMLTextAreaElement ||
              el instanceof HTMLSelectElement) &&
            el.name
          ) {
            data[el.name] = el.value.trim();
          }
        }
        return data;
      };

      const fillReview = () => {
        const confirm = panels.get("confirm");
        if (!confirm) return;
        const slots = confirm.querySelectorAll<HTMLElement>(`[data-${ns}-review]`);
        for (const slot of Array.from(slots)) {
          const key = slot.getAttribute(`data-${ns}-review`) ?? "";
          const raw = fieldValue(key);
          const labelMap = labelsByField[key];
          if (labelMap) {
            slot.textContent = labelMap[raw] ?? raw;
          } else if (raw === "") {
            slot.textContent = "(not filled in)";
          } else {
            slot.textContent = raw;
          }
        }
      };

      // input -> confirm: run native validation (required/email) first.
      const onSubmit = (ev: Event) => {
        ev.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        fillReview();
        show("confirm");
      };
      form.addEventListener("submit", onSubmit);
      cleanups.push(() => form.removeEventListener("submit", onSubmit));

      const onClick = (ev: Event) => {
        const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(
          `[data-${ns}-action]`,
        );
        if (!target || !root.contains(target)) return;
        const action = target.getAttribute(`data-${ns}-action`);
        if (action === "edit") {
          show("input");
        } else if (action === "send") {
          // Robustness guard: never reach "complete" without having shown
          // confirm first (e.g. a direct click dispatched without a prior
          // submit).
          if (!isConfirmVisible(panels)) return;
          if (!submitAdapter) {
            // Default: local-only transition, no network (reference behavior).
            show("complete");
            return;
          }
          setBusy(true);
          submitAdapter(collectFormData())
            .then(() => {
              setBusy(false);
              show("complete");
            })
            .catch((err: unknown) => {
              setBusy(false);
              setError(err instanceof Error ? err.message : String(err));
            });
        } else if (action === "reset") {
          form.reset();
          show("input");
        }
      };
      root.addEventListener("click", onClick);
      cleanups.push(() => root.removeEventListener("click", onClick));
    }

    return () => cleanups.forEach((fn) => fn());
  };
}
