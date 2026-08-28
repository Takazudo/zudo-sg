import { Field } from "../field/field";
import { Input } from "../input/input";
import { Textarea } from "../textarea/textarea";
import { Select } from "../select/select";
import { SubmitButton } from "../submit-button/submit-button";
import { SecondaryButton } from "../secondary-button/secondary-button";
import { ReviewRow } from "../review-row/review-row";
import { PURPOSE_OPTIONS } from "../lib/form-options";

export type ContactFormProps = {
  class?: string;
};

/**
 * ContactForm — self-contained inquiry form (input -> confirm -> complete),
 * SSR-rendered as plain markup with no runtime behavior of its own.
 *
 * All three panels render server-side; without any client JS the input panel
 * is the only one visible and the `<form>` has no `action`, so an
 * unenhanced submit is a no-op (static fallback). The paired
 * `ContactFormEnhancer` island (same directory) is what drives the actual
 * input -> confirm -> complete flow and the optional async submit-adapter
 * error path — @zudo-sg/ui ships no zfb dependency, so mounting that island
 * (`<Island when="visible" ssrFallback={null}><ContactFormEnhancer /></Island>`)
 * is the consuming app's job, not this component's. It only needs to be
 * present somewhere in the same document; it finds this form via
 * `[data-contact-form]`, not via DOM nesting.
 *
 * DOM hooks the paired enhancer relies on (keep in sync — see
 * create-form-enhancer.ts's header comment for the full contract):
 *   root              [data-contact-form]
 *   input form        [data-contact-form-el]
 *   panels            [data-contact-panel="input"|"confirm"|"complete"]
 *   actions           [data-contact-action="edit"|"send"|"reset"]
 *   review slots      [data-contact-review="<field>"]
 *   error slot        [data-contact-error]
 */
export function ContactForm({ class: cls }: ContactFormProps) {
  return (
    <section
      class={["flex flex-col gap-y-vsp-md", cls].filter(Boolean).join(" ")}
      aria-label="Contact form"
      data-contact-form
    >
      <div class="flex flex-col gap-y-vsp-2xs">
        <h2 class="text-heading font-bold leading-tight text-fg">Contact form</h2>
        <p class="max-w-[44rem] text-caption leading-relaxed text-muted">
          Fill in and submit the form below. Our team will review it and follow up with you.
          Fields marked <span class="text-accent">Required</span> must be filled in.
        </p>
      </div>

      {/* Input panel (shown initially). No `action` — unenhanced submit is a no-op. */}
      <div data-contact-panel="input">
        <form
          data-contact-form-el
          class="flex flex-col gap-y-vsp-md rounded-md border border-border bg-surface px-hsp-lg py-vsp-md"
          novalidate
        >
          <Field id="contact-purpose" label="Inquiry type" required>
            <Select id="contact-purpose" name="purpose" options={PURPOSE_OPTIONS} required />
          </Field>

          <div class="grid grid-cols-1 gap-hsp-md sm:grid-cols-2">
            <Field id="contact-name" label="Name" required>
              <Input id="contact-name" name="name" autocomplete="name" required />
            </Field>
            <Field id="contact-company" label="Company / organization" hint="Leave blank for individual inquiries.">
              <Input id="contact-company" name="company" autocomplete="organization" />
            </Field>
          </div>

          <Field id="contact-email" label="Email" required hint="Used to reply to your inquiry.">
            <Input id="contact-email" name="email" type="email" autocomplete="email" required />
          </Field>

          <Field id="contact-message" label="Message" required>
            <Textarea id="contact-message" name="message" rows={7} required />
          </Field>

          <div class="flex flex-col gap-y-vsp-xs">
            <p class="text-micro leading-snug text-muted">
              Personal information you provide is used solely to respond to your inquiry.
            </p>
            <SubmitButton class="self-start">Review my entry</SubmitButton>
          </div>
        </form>
      </div>

      {/* Confirm panel (hidden until the enhancer fills it from the input panel). */}
      <div data-contact-panel="confirm" hidden>
        <div class="flex flex-col gap-y-vsp-md rounded-md border border-border bg-surface px-hsp-lg py-vsp-md">
          <div class="flex flex-col gap-y-vsp-2xs">
            <h3 class="text-title font-semibold text-fg">Confirm your entry</h3>
            <p class="text-caption leading-relaxed text-muted">
              Review the details below before sending. Use "Back to edit" to make changes.
            </p>
          </div>

          <dl class="flex flex-col gap-y-vsp-sm">
            <ReviewRow label="Inquiry type" reviewAttr="data-contact-review" field="purpose" />
            <ReviewRow label="Name" reviewAttr="data-contact-review" field="name" />
            <ReviewRow label="Company / organization" reviewAttr="data-contact-review" field="company" />
            <ReviewRow label="Email" reviewAttr="data-contact-review" field="email" />
            <ReviewRow label="Message" reviewAttr="data-contact-review" field="message" multiline />
          </dl>

          {/* Filled in by the enhancer only when an async submit adapter rejects
              (see create-form-enhancer.ts). Absent an adapter, "Send" never
              fails locally, so this stays empty and hidden. */}
          <p data-contact-error role="alert" hidden class="text-caption font-medium text-danger" />

          <div class="flex flex-wrap gap-x-hsp-md gap-y-vsp-xs">
            <SecondaryButton data-contact-action="edit">Back to edit</SecondaryButton>
            <SubmitButton type="button" data-contact-action="send">
              Send this
            </SubmitButton>
          </div>
        </div>
      </div>

      {/* Complete panel (hidden until the enhancer shows it after a successful send). */}
      <div data-contact-panel="complete" hidden>
        <div
          class="flex flex-col gap-y-vsp-sm rounded-md border border-border border-l-4 px-hsp-lg py-vsp-md"
          style={{
            borderLeftColor: "var(--color-accent)",
            backgroundColor: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))",
          }}
          role="status"
        >
          <h3 class="text-title font-semibold text-accent">Your inquiry has been received</h3>
          <p class="text-small leading-relaxed text-fg">
            We've received your message and will follow up at the email address you provided.
          </p>
          <SecondaryButton class="self-start" data-contact-action="reset">
            Start another inquiry
          </SecondaryButton>
        </div>
      </div>
    </section>
  );
}
