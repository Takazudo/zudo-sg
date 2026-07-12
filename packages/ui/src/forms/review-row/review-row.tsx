import { cx } from "../../lib/cx";

export type ReviewRowProps = {
  label: string;
  /** Attribute name the paired `*-form-enhancer` writes the value into (e.g. "data-contact-review"). */
  reviewAttr: string;
  /** Field name — becomes that attribute's value. */
  field: string;
  multiline?: boolean;
  class?: string;
};

/**
 * One row of a form's confirm panel: a label plus a `<dd>` the paired
 * `*-form-enhancer` island fills in via `[data-{ns}-review="<field>"]`. The
 * attribute name is dynamic (per-form namespace), so it's built as a plain
 * object and spread — JSX can't target a non-literal attribute name directly.
 */
export function ReviewRow({ label, reviewAttr, field, multiline = false, class: cls }: ReviewRowProps) {
  const ddDataAttr = { [reviewAttr]: field } as Record<string, string>;

  return (
    <div
      class={cx(
        "grid grid-cols-1 gap-y-vsp-2xs border-b border-border pb-vsp-sm sm:grid-cols-[12rem_1fr] sm:gap-x-hsp-md",
        cls,
      )}
    >
      <dt class="text-caption font-semibold text-muted">{label}</dt>
      <dd class={cx("text-small text-fg", multiline && "whitespace-pre-wrap")} {...ddDataAttr} />
    </div>
  );
}
