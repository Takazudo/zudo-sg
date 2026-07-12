import { cloneElement, isValidElement, toChildArray } from "preact";
import type { ComponentChildren, VNode } from "preact";
import { cx } from "../../lib/cx";

export type FieldProps = {
  /** Control id — wired to the label via `htmlFor` and back via the control's own `id`. */
  id: string;
  label: string;
  /** Shows a "Required"/"Optional" badge next to the label. */
  required?: boolean;
  /** Helper text rendered between the label and the control. */
  hint?: string;
  class?: string;
  children?: ComponentChildren;
};

/**
 * Labeled form row: label + required/optional badge + optional hint, wrapping
 * a control (Input/Textarea/Select). When `hint` is set, this injects
 * `aria-describedby` onto the slotted control(s) so assistive tech reads the
 * hint on focus — the control just needs to forward unknown props (`{...rest}`
 * onto its root element, which every @zudo-sg/ui forms control does.
 */
export function Field({ id, label, required = false, hint, class: cls, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const control = hintId
    ? toChildArray(children).map((child) =>
        isValidElement(child)
          ? cloneElement(child as VNode<Record<string, unknown>>, { "aria-describedby": hintId })
          : child,
      )
    : children;

  return (
    <div class={cx("flex flex-col gap-y-vsp-2xs", cls)}>
      <label for={id} class="text-caption font-semibold text-fg">
        {label}
        {required ? (
          <span class="ms-hsp-2xs align-middle text-micro font-medium text-accent">Required</span>
        ) : (
          <span class="ms-hsp-2xs align-middle text-micro font-normal text-muted">Optional</span>
        )}
      </label>
      {hint && (
        <p id={hintId} class="text-micro leading-snug text-muted">
          {hint}
        </p>
      )}
      {control}
    </div>
  );
}
