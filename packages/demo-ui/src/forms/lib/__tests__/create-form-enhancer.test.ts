/**
 * Form-enhancer tests (converted from the reference's Node `--test` suite).
 *
 * The reference suite hand-rolled minimal Element/EventTarget mocks because it
 * ran under plain Node. Here vitest's `happy-dom` environment gives a real
 * `document`, so these tests build the actual DOM shape a ported `*-form.tsx`
 * renders (root -> panels -> form -> review/error slots) and exercise the
 * production `createFormEnhancer` against it directly — no logic is
 * reimplemented in the test.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormEnhancer, isConfirmVisible, type Panel } from "../create-form-enhancer";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isConfirmVisible", () => {
  it("returns false when the confirm panel is hidden", () => {
    const panels = new Map<Panel, { hidden: boolean }>([
      ["input", { hidden: false }],
      ["confirm", { hidden: true }],
      ["complete", { hidden: true }],
    ]);
    expect(isConfirmVisible(panels)).toBe(false);
  });

  it("returns true when the confirm panel is visible", () => {
    const panels = new Map<Panel, { hidden: boolean }>([
      ["input", { hidden: true }],
      ["confirm", { hidden: false }],
      ["complete", { hidden: true }],
    ]);
    expect(isConfirmVisible(panels)).toBe(true);
  });

  it("returns false when the confirm panel does not exist", () => {
    const panels = new Map<Panel, { hidden: boolean }>([
      ["input", { hidden: false }],
      ["complete", { hidden: true }],
    ]);
    expect(isConfirmVisible(panels)).toBe(false);
  });
});

/**
 * Builds the minimal DOM shape a ported `*-form.tsx` renders — root, three
 * panels, an input `<form>`, review slots, and an optional error slot — and
 * appends it to `document.body`. `confirmVisible` seeds the panels straight
 * into the post-submit state so tests can exercise the "send" guard without
 * depending on native form submission.
 */
function mountForm(
  ns: string,
  options: { confirmVisible?: boolean; withErrorSlot?: boolean } = {},
): { root: HTMLElement; form: HTMLFormElement } {
  const { confirmVisible = false, withErrorSlot = true } = options;
  const root = document.createElement("section");
  root.setAttribute(`data-${ns}-form`, "");
  root.innerHTML = `
    <div data-${ns}-panel="input">
      <form data-${ns}-form-el>
        <select name="purpose" required>
          <option value="product">Product inquiry</option>
          <option value="other">Other</option>
        </select>
        <input name="name" required />
        <input name="company" />
        <input name="email" type="email" required />
        <textarea name="message" required></textarea>
        <button type="submit">Confirm</button>
      </form>
    </div>
    <div data-${ns}-panel="confirm" hidden>
      <h3>Confirm</h3>
      <dl>
        <dd data-${ns}-review="purpose"></dd>
        <dd data-${ns}-review="name"></dd>
        <dd data-${ns}-review="company"></dd>
        <dd data-${ns}-review="email"></dd>
        <dd data-${ns}-review="message"></dd>
      </dl>
      ${withErrorSlot ? `<p data-${ns}-error role="alert" hidden></p>` : ""}
      <button type="button" data-${ns}-action="edit">Edit</button>
      <button type="button" data-${ns}-action="send">Send</button>
    </div>
    <div data-${ns}-panel="complete" hidden>
      <h3>Done</h3>
      <button type="button" data-${ns}-action="reset">Reset</button>
    </div>
  `;
  document.body.appendChild(root);

  if (confirmVisible) {
    root.querySelector<HTMLElement>(`[data-${ns}-panel="input"]`)!.hidden = true;
    root.querySelector<HTMLElement>(`[data-${ns}-panel="confirm"]`)!.hidden = false;
  }

  const form = root.querySelector<HTMLFormElement>(`[data-${ns}-form-el]`)!;
  return { root, form };
}

function panel(root: HTMLElement, ns: string, name: "input" | "confirm" | "complete") {
  return root.querySelector<HTMLElement>(`[data-${ns}-panel="${name}"]`)!;
}

function fillField(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = value;
}

describe("createFormEnhancer — submit guard (click -> panel transition)", () => {
  it("does not advance to complete when the confirm panel is hidden", () => {
    const { root } = mountForm("contact", { confirmVisible: false });
    const dispose = createFormEnhancer("contact", {})();

    (root.querySelector('[data-contact-action="send"]') as HTMLButtonElement).click();

    expect(panel(root, "contact", "complete").hidden).toBe(true);
    dispose();
  });

  it("advances to complete when the confirm panel is visible (default: no network)", () => {
    const { root } = mountForm("contact", { confirmVisible: true });
    const dispose = createFormEnhancer("contact", {})();

    (root.querySelector('[data-contact-action="send"]') as HTMLButtonElement).click();

    expect(panel(root, "contact", "complete").hidden).toBe(false);
    expect(panel(root, "contact", "confirm").hidden).toBe(true);
    dispose();
  });
});

describe("createFormEnhancer — input -> confirm (native validation + review fill)", () => {
  it("fills the review slots from field values, using the label map where present", () => {
    const { root, form } = mountForm("contact");
    const dispose = createFormEnhancer("contact", { purpose: { product: "Product inquiry" } })();

    fillField(form, "purpose", "product");
    fillField(form, "name", "Ada Lovelace");
    fillField(form, "email", "ada@example.com");
    fillField(form, "message", "Hello there");
    // "company" left blank on purpose — optional field, no label map.

    form.requestSubmit();

    expect(panel(root, "contact", "confirm").hidden).toBe(false);
    expect(root.querySelector('[data-contact-review="purpose"]')).toHaveTextContent(
      "Product inquiry",
    );
    expect(root.querySelector('[data-contact-review="name"]')).toHaveTextContent("Ada Lovelace");
    expect(root.querySelector('[data-contact-review="company"]')).toHaveTextContent(
      "(not filled in)",
    );
    dispose();
  });

  it("blocks the input -> confirm transition when a required field is empty", () => {
    const { root, form } = mountForm("contact");
    const dispose = createFormEnhancer("contact", {})();

    // "name", "email", "message" are required and left blank.
    form.requestSubmit();

    expect(panel(root, "contact", "confirm").hidden).toBe(true);
    expect(panel(root, "contact", "input").hidden).toBe(false);
    dispose();
  });
});

describe("createFormEnhancer — injectable async submit adapter", () => {
  it("without an adapter, send transitions straight to complete (default, no network)", () => {
    const { root } = mountForm("contact", { confirmVisible: true });
    const dispose = createFormEnhancer("contact", {})();

    (root.querySelector('[data-contact-action="send"]') as HTMLButtonElement).click();

    expect(panel(root, "contact", "complete").hidden).toBe(false);
    dispose();
  });

  it("on success, awaits the adapter with the collected field values, then shows complete", async () => {
    const { root, form } = mountForm("contact", { confirmVisible: true });
    fillField(form, "name", "Ada Lovelace");
    fillField(form, "email", "ada@example.com");

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const dispose = createFormEnhancer("contact", {})(onSubmit);

    const sendBtn = root.querySelector<HTMLButtonElement>('[data-contact-action="send"]')!;
    sendBtn.click();

    // Busy while the adapter's promise is in flight.
    expect(sendBtn.disabled).toBe(true);
    expect(root).toHaveAttribute("aria-busy", "true");

    await vi.waitFor(() => expect(panel(root, "contact", "complete").hidden).toBe(false));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ada Lovelace", email: "ada@example.com" }),
    );
    expect(sendBtn.disabled).toBe(false);
    expect(root).toHaveAttribute("aria-busy", "false");
    dispose();
  });

  it("on rejection, keeps the confirm panel open and shows the error, re-enabling retry", async () => {
    const { root } = mountForm("contact", { confirmVisible: true });
    const onSubmit = vi.fn().mockRejectedValue(new Error("Server rejected the request"));
    const dispose = createFormEnhancer("contact", {})(onSubmit);

    const sendBtn = root.querySelector<HTMLButtonElement>('[data-contact-action="send"]')!;
    sendBtn.click();

    await vi.waitFor(() => expect(sendBtn.disabled).toBe(false));

    // Failure: confirm stays open, complete never shows, error slot renders the message.
    expect(panel(root, "contact", "confirm").hidden).toBe(false);
    expect(panel(root, "contact", "complete").hidden).toBe(true);
    const errorEl = root.querySelector('[data-contact-error]') as HTMLElement;
    expect(errorEl.hidden).toBe(false);
    expect(errorEl).toHaveTextContent("Server rejected the request");
    expect(root).toHaveAttribute("aria-busy", "false");

    // Retry: a second, successful attempt clears the error and completes.
    onSubmit.mockResolvedValueOnce(undefined);
    sendBtn.click();
    await vi.waitFor(() => expect(panel(root, "contact", "complete").hidden).toBe(false));
    expect(errorEl.hidden).toBe(true);

    dispose();
  });

  it("does nothing when send is clicked while confirm is hidden, even with an adapter", () => {
    const { root } = mountForm("contact", { confirmVisible: false });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const dispose = createFormEnhancer("contact", {})(onSubmit);

    (root.querySelector('[data-contact-action="send"]') as HTMLButtonElement).click();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(panel(root, "contact", "complete").hidden).toBe(true);
    dispose();
  });
});
