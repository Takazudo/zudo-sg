import { Field } from "../field/field";
import { Input } from "../input/input";
import { Textarea } from "../textarea/textarea";
import { Select } from "../select/select";
import { SubmitButton } from "../submit-button/submit-button";
import { SecondaryButton } from "../secondary-button/secondary-button";
import { ReviewRow } from "../review-row/review-row";
import { CATEGORY_OPTIONS, JOB_OPTIONS } from "../lib/form-options";

export type RecruitEntryFormProps = {
  /** Pre-selects the recruiting category — set by category-specific pages. */
  defaultCategory?: "new-graduate" | "career";
  class?: string;
};

/**
 * RecruitEntryForm — self-contained recruiting entry form (input -> confirm
 * -> complete), SSR-rendered as plain markup with no runtime behavior of its
 * own. Same progressive-enhancement shape as ContactForm (see its header
 * comment) — the paired `RecruitFormEnhancer` island (same directory) drives
 * the actual flow; @zudo-sg/ui ships no zfb dependency, so mounting that
 * island is the consuming app's job.
 *
 * DOM hooks the paired enhancer relies on:
 *   root              [data-recruit-form]
 *   input form        [data-recruit-form-el]
 *   panels            [data-recruit-panel="input"|"confirm"|"complete"]
 *   actions           [data-recruit-action="edit"|"send"|"reset"]
 *   review slots      [data-recruit-review="<field>"]
 */
export function RecruitEntryForm({ defaultCategory, class: cls }: RecruitEntryFormProps) {
  return (
    <section
      class={["flex flex-col gap-y-vsp-md", cls].filter(Boolean).join(" ")}
      aria-label="Recruiting entry form"
      data-recruit-form
    >
      <div class="flex flex-col gap-y-vsp-2xs">
        <h2 class="text-heading font-bold leading-tight text-fg">Entry form</h2>
        <p class="max-w-[44rem] text-caption leading-relaxed text-muted">
          Fill in and submit the form below. Our recruiting team will review it and email
          you with next steps. Fields marked <span class="text-accent">Required</span> must be
          filled in.
        </p>
      </div>

      <div data-recruit-panel="input">
        <form
          data-recruit-form-el
          class="flex flex-col gap-y-vsp-md rounded-md border border-border bg-surface px-hsp-lg py-vsp-md"
          novalidate
        >
          <Field id="recruit-category" label="Recruiting category" required>
            <Select
              id="recruit-category"
              name="category"
              options={CATEGORY_OPTIONS}
              value={defaultCategory}
              required
            />
          </Field>

          <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2">
            <Field id="recruit-name" label="Name" required>
              <Input id="recruit-name" name="name" autocomplete="name" required />
            </Field>
            <Field id="recruit-kana" label="Name (phonetic)" required>
              <Input id="recruit-kana" name="kana" required />
            </Field>
          </div>

          <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2">
            <Field id="recruit-email" label="Email" required hint="Used for interview/next-step scheduling.">
              <Input id="recruit-email" name="email" type="email" autocomplete="email" required />
            </Field>
            <Field id="recruit-phone" label="Phone number" required hint="A number you can be reached at during business hours.">
              <Input id="recruit-phone" name="phone" type="tel" autocomplete="tel" required />
            </Field>
          </div>

          <Field
            id="recruit-affiliation"
            label="Affiliation (school / current employer)"
            hint="New graduates: school and department. Career: current employer."
          >
            <Input id="recruit-affiliation" name="affiliation" autocomplete="organization" />
          </Field>

          <Field id="recruit-job" label="Desired role" required>
            <Select id="recruit-job" name="job" options={JOB_OPTIONS} required />
          </Field>

          <Field
            id="recruit-message"
            label="Self-introduction / questions"
            hint="Feel free to share your motivation, experience, or any questions."
          >
            <Textarea id="recruit-message" name="message" rows={6} />
          </Field>

          <div class="flex flex-col gap-y-vsp-xs">
            <p class="text-micro leading-snug text-muted">
              Personal information you provide is used solely for recruiting-related
              communication.
            </p>
            <SubmitButton class="self-start">Review my entry</SubmitButton>
          </div>
        </form>
      </div>

      <div data-recruit-panel="confirm" hidden>
        <div class="flex flex-col gap-y-vsp-md rounded-md border border-border bg-surface px-hsp-lg py-vsp-md">
          <div class="flex flex-col gap-y-vsp-2xs">
            <h3 class="text-title font-semibold text-fg">Confirm your entry</h3>
            <p class="text-caption leading-relaxed text-muted">
              Review the details below before sending. Use "Back to edit" to make changes.
            </p>
          </div>

          <dl class="flex flex-col gap-y-vsp-sm">
            <ReviewRow label="Recruiting category" reviewAttr="data-recruit-review" field="category" />
            <ReviewRow label="Name" reviewAttr="data-recruit-review" field="name" />
            <ReviewRow label="Name (phonetic)" reviewAttr="data-recruit-review" field="kana" />
            <ReviewRow label="Email" reviewAttr="data-recruit-review" field="email" />
            <ReviewRow label="Phone number" reviewAttr="data-recruit-review" field="phone" />
            <ReviewRow label="Affiliation" reviewAttr="data-recruit-review" field="affiliation" />
            <ReviewRow label="Desired role" reviewAttr="data-recruit-review" field="job" />
            <ReviewRow
              label="Self-introduction / questions"
              reviewAttr="data-recruit-review"
              field="message"
              multiline
            />
          </dl>

          <div class="flex flex-wrap gap-x-hsp-md gap-y-vsp-xs">
            <SecondaryButton data-recruit-action="edit">Back to edit</SecondaryButton>
            <SubmitButton type="button" data-recruit-action="send">
              Submit this entry
            </SubmitButton>
          </div>
        </div>
      </div>

      <div data-recruit-panel="complete" hidden>
        <div
          class="flex flex-col gap-y-vsp-sm rounded-md border border-border border-l-4 px-hsp-lg py-vsp-md"
          style={{
            borderLeftColor: "var(--color-accent)",
            backgroundColor: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))",
          }}
          role="status"
        >
          <h3 class="text-title font-semibold text-accent">Your entry has been received</h3>
          <p class="text-small leading-relaxed text-fg">
            We've received your entry. Our recruiting team will follow up at the email
            address you provided with details on next steps. Thank you for applying.
          </p>
          <SecondaryButton class="self-start" data-recruit-action="reset">
            Start another entry
          </SecondaryButton>
        </div>
      </div>
    </section>
  );
}
