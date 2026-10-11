import type { Child } from "@takazudo/zfb/zudo-react";
import { cx } from "../../lib/cx";

export type FieldProps = {
  /** Control id — wired to the label via `for` and back via the control's own `id`. */
  id: string;
  label: string;
  /** Shows a "Required"/"Optional" badge next to the label. */
  required?: boolean;
  /** Helper text rendered between the label and the control. */
  hint?: string;
  class?: string;
  children: (ctl: { id: string; describedBy: string | undefined }) => Child;
};

/**
 * Labeled form row. The render prop receives the control id and optional hint
 * reference; forward both as `id` and `aria-describedby` on the control.
 */
export function Field({ id, label, required = false, hint, class: cls, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const control = children({ id, describedBy: hintId });

  return (
    <div class={cx("flex flex-col gap-y-vsp-2xs", cls)}>
      <label for={id} class="text-caption font-semibold text-fg">
        {label}
        {required ? (
          <span class="zc-field-badge align-middle text-micro font-medium text-accent">Required</span>
        ) : (
          <span class="zc-field-badge align-middle text-micro font-normal text-muted">Optional</span>
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
