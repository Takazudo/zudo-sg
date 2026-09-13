import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { ContactForm } from "../contact-form";
import ContactFormEnhancer from "../contact-form-enhancer";

describe("ContactForm", () => {
  it("renders only the input panel's fields as visible (confirm/complete stay hidden)", () => {
    render(<ContactForm />);
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Inquiry type/ })).toBeInTheDocument();
    const confirmHeading = screen.getByText("Confirm your entry");
    expect(confirmHeading.closest("[data-contact-panel]")).toHaveAttribute("hidden");
    const completeHeading = screen.getByText("Your inquiry has been received");
    expect(completeHeading.closest("[data-contact-panel]")).toHaveAttribute("hidden");
  });

  it("has no action on the <form> (static fallback: no real navigation without the enhancer)", () => {
    render(<ContactForm />);
    const form = document.querySelector("[data-contact-form-el]");
    expect(form).not.toHaveAttribute("action");
  });
});

/** Fills every required input-panel field so native validation passes. Targeted
 * by id (not label text) — the label's accessible name also picks up the
 * adjacent Required/Optional badge text, so an id lookup is the robust match. */
function fillRequiredFields() {
  fireEvent.input(document.getElementById("contact-name") as HTMLInputElement, {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.input(document.getElementById("contact-email") as HTMLInputElement, {
    target: { value: "ada@example.com" },
  });
  fireEvent.input(document.getElementById("contact-message") as HTMLTextAreaElement, {
    target: { value: "Hello there" },
  });
}

describe("ContactForm + ContactFormEnhancer (real ported markup, mounted together)", () => {
  it("advances input -> confirm -> complete with no adapter (default, no network)", async () => {
    render(
      <div>
        <ContactForm />
        <ContactFormEnhancer />
      </div>,
    );

    fillRequiredFields();
    fireEvent.submit(document.querySelector("[data-contact-form-el]") as HTMLFormElement);

    await waitFor(() =>
      expect(screen.getByText("Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Send this" }));

    await waitFor(() =>
      expect(
        screen.getByText("Your inquiry has been received").closest("[data-contact-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
  });

  it("with a rejecting submit adapter, keeps confirm open and shows the error; a later success completes", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server rejected the request"))
      .mockResolvedValueOnce(undefined);

    render(
      <div>
        <ContactForm />
        <ContactFormEnhancer onSubmit={onSubmit} />
      </div>,
    );

    fillRequiredFields();
    fireEvent.submit(document.querySelector("[data-contact-form-el]") as HTMLFormElement);
    await waitFor(() =>
      expect(screen.getByText("Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    const sendButton = screen.getByRole("button", { name: "Send this" });
    fireEvent.click(sendButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Server rejected the request");
    expect(screen.getByText("Confirm your entry").closest("[data-contact-panel]")).not.toHaveAttribute(
      "hidden",
    );
    expect(
      screen.getByText("Your inquiry has been received").closest("[data-contact-panel]"),
    ).toHaveAttribute("hidden");

    // Retry succeeds.
    await waitFor(() => expect(sendButton).not.toBeDisabled());
    fireEvent.click(sendButton);
    await waitFor(() =>
      expect(
        screen.getByText("Your inquiry has been received").closest("[data-contact-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
