import type { ComponentChildren, JSX } from "preact";
import { cx } from "../lib/cx";

/* Shared field-control surface (input + textarea). */
const control =
  "w-full rounded-md border bg-surface px-hsp-md py-vsp-2xs text-sm text-ink " +
  "placeholder:text-ink-mute outline-none transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const controlOk = "border-line focus-visible:border-brand";
const controlInvalid = "border-danger focus-visible:outline-danger";

export type InputProps = {
  invalid?: boolean;
  class?: string;
} & Omit<JSX.IntrinsicElements["input"], "class" | "size">;

/** Text input. `type` defaults to "text". Pairs with <Field>. */
export function Input({ invalid = false, class: cls, type, ...rest }: InputProps) {
  return (
    <input
      type={type ?? "text"}
      class={cx(control, invalid ? controlInvalid : controlOk, cls)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export type TextareaProps = {
  invalid?: boolean;
  class?: string;
} & Omit<JSX.IntrinsicElements["textarea"], "class">;

/** Multi-line text input; vertical resize only. */
export function Textarea({ invalid = false, class: cls, rows, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows ?? 4}
      class={cx(control, "resize-y", invalid ? controlInvalid : controlOk, cls)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

let fieldSeq = 0;
function nextId(prefix: string) {
  fieldSeq += 1;
  return `${prefix}-${fieldSeq}`;
}

type FieldProps = {
  label: ComponentChildren;
  /** id wired to the control via htmlFor; auto-generated when omitted. */
  htmlFor?: string;
  /** Helper text under the control. */
  hint?: ComponentChildren;
  /** Error message; when set the control should be rendered invalid too. */
  error?: ComponentChildren;
  required?: boolean;
  class?: string;
  /**
   * Render the control. Receives the resolved `id` and the
   * `aria-describedby` to wire onto the control, so the label + hint/error
   * are correctly associated.
   */
  children: (controlProps: { id: string; "aria-describedby"?: string }) => ComponentChildren;
};

/**
 * Labeled form row: label + control + hint/error, with accessible wiring
 * (label htmlFor, aria-describedby). The control is supplied via a render
 * function so any input type composes in.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  class: cls,
  children,
}: FieldProps) {
  const id = htmlFor ?? nextId("field");
  const describedById = hint || error ? `${id}-desc` : undefined;

  return (
    <div class={cx("flex flex-col gap-vsp-3xs", cls)}>
      <label for={id} class="text-sm font-medium text-ink">
        {label}
        {required && (
          <span class="ml-hsp-2xs text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, "aria-describedby": describedById })}
      {error ? (
        <p id={describedById} class="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={describedById} class="text-xs text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
