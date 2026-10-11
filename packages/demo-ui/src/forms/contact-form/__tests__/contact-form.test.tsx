import { renderIsland, getByRole, getByText, fire } from "../../../test-utils/zudo-react";
import { describe, expect, it, vi } from "vitest";
import { ContactForm } from "../contact-form";
import ContactFormEnhancer from "../contact-form-enhancer";

describe("ContactForm", () => {
  it("renders only the input panel's fields as visible (confirm/complete stay hidden)", () => {
    const { container } = renderIsland(function Fixture() {
      return <ContactForm />;
    }, {});
    expect(getByRole(container, "textbox", { name: /Name/ })).toBeInTheDocument();
    expect(getByRole(container, "combobox", { name: /Inquiry type/ })).toBeInTheDocument();
    const confirmHeading = getByText(container, "Confirm your entry");
    expect(confirmHeading.closest("[data-contact-panel]")).toHaveAttribute("hidden");
    const completeHeading = getByText(container, "Your inquiry has been received");
    expect(completeHeading.closest("[data-contact-panel]")).toHaveAttribute("hidden");
  });

  it("has no action on the <form> (static fallback: no real navigation without the enhancer)", () => {
    const { container } = renderIsland(function Fixture() {
      return <ContactForm />;
    }, {});
    const form = container.querySelector("[data-contact-form-el]");
    expect(form).not.toHaveAttribute("action");
  });
});

/** Fills every required input-panel field so native validation passes. Targeted
 * by id (not label text) — the label's accessible name also picks up the
 * adjacent Required/Optional badge text, so an id lookup is the robust match. */
function fillRequiredFields(container: Element) {
  (container.querySelector("#contact-name") as HTMLInputElement).value = "Ada Lovelace";
  fire(container.querySelector("#contact-name") as HTMLInputElement, "input");
  (container.querySelector("#contact-email") as HTMLInputElement).value = "ada@example.com";
  fire(container.querySelector("#contact-email") as HTMLInputElement, "input");
  (container.querySelector("#contact-message") as HTMLTextAreaElement).value = "Hello there";
  fire(container.querySelector("#contact-message") as HTMLTextAreaElement, "input");
}

describe("ContactForm + ContactFormEnhancer (real ported markup, mounted together)", () => {
  it("advances input -> confirm -> complete with no adapter (default, no network)", async () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <div>
          <ContactForm />
          <ContactFormEnhancer />
        </div>
      );
    }, {});

    fillRequiredFields(container);
    fire(container.querySelector("[data-contact-form-el]") as HTMLFormElement, "submit");

    await vi.waitFor(() =>
      expect(getByText(container, "Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    fire(getByRole(container, "button", { name: "Send this" }), "click");

    await vi.waitFor(() =>
      expect(
        getByText(container, "Your inquiry has been received").closest("[data-contact-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
  });

  it("with a rejecting submit adapter, keeps confirm open and shows the error; a later success completes", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server rejected the request"))
      .mockResolvedValueOnce(undefined);

    const { container } = renderIsland(function Fixture() {
      return (
        <div>
          <ContactForm />
          <ContactFormEnhancer onSubmit={onSubmit} />
        </div>
      );
    }, {});

    fillRequiredFields(container);
    fire(container.querySelector("[data-contact-form-el]") as HTMLFormElement, "submit");
    await vi.waitFor(() =>
      expect(getByText(container, "Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    const sendButton = getByRole(container, "button", { name: "Send this" });
    fire(sendButton, "click");

    const alert = getByRole(container, "alert");
    await vi.waitFor(() => expect(alert).toHaveTextContent("Server rejected the request"));
    expect(alert).toHaveTextContent("Server rejected the request");
    expect(getByText(container, "Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
      "hidden",
    );
    expect(
      getByText(container, "Your inquiry has been received").closest("[data-contact-panel]"),
    ).toHaveAttribute("hidden");

    // Retry succeeds.
    await vi.waitFor(() => expect(sendButton).not.toBeDisabled());
    fire(sendButton, "click");
    await vi.waitFor(() =>
      expect(
        getByText(container, "Your inquiry has been received").closest("[data-contact-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
  it("removes enhancer listeners when its scope is disposed", () => {
    const result = renderIsland(function CleanupFixture() {
      return <div><ContactForm /><ContactFormEnhancer /></div>;
    }, {});
    const form = result.container.querySelector("[data-contact-form-el]")!;
    const confirm = result.container.querySelector('[data-contact-panel="confirm"]')!;
    result.dispose();
    // Keep the detached DOM reference: an orphaned listener would still cancel
    // this event even after its owning scope disappeared.
    expect(fire(form, "submit", { cancelable: true })).toBe(true);
    expect(confirm).toHaveAttribute("hidden");
  });

});
