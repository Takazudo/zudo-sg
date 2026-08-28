import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { RecruitEntryForm } from "../recruit-entry-form";
import RecruitFormEnhancer from "../recruit-form-enhancer";

describe("RecruitEntryForm", () => {
  it("renders the input panel with the category select pre-selected via defaultCategory", () => {
    render(<RecruitEntryForm defaultCategory="career" />);
    const select = screen.getByRole("combobox", { name: /Recruiting category/ }) as HTMLSelectElement;
    expect(select.value).toBe("career");
  });

  it("keeps confirm/complete panels hidden until enhanced", () => {
    render(<RecruitEntryForm />);
    expect(screen.getByText("Confirm your entry").closest("[data-recruit-panel]")).toHaveAttribute(
      "hidden",
    );
    expect(
      screen.getByText("Your entry has been received").closest("[data-recruit-panel]"),
    ).toHaveAttribute("hidden");
  });
});

describe("RecruitEntryForm + RecruitFormEnhancer (real ported markup, mounted together)", () => {
  it("advances input -> confirm -> complete (default, no network)", async () => {
    render(
      <div>
        <RecruitEntryForm defaultCategory="new-graduate" />
        <RecruitFormEnhancer />
      </div>,
    );

    // Targeted by id (not label text) — "Name" and "Name (phonetic)" both start
    // with "Name", so a label-text query would be ambiguous.
    fireEvent.input(document.getElementById("recruit-name") as HTMLInputElement, {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.input(document.getElementById("recruit-kana") as HTMLInputElement, {
      target: { value: "Ada" },
    });
    fireEvent.input(document.getElementById("recruit-email") as HTMLInputElement, {
      target: { value: "ada@example.com" },
    });
    fireEvent.input(document.getElementById("recruit-phone") as HTMLInputElement, {
      target: { value: "0120000000" },
    });

    fireEvent.submit(document.querySelector("[data-recruit-form-el]") as HTMLFormElement);

    await waitFor(() =>
      expect(screen.getByText("Confirm your entry").closest("[data-recruit-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit this entry" }));

    await waitFor(() =>
      expect(
        screen.getByText("Your entry has been received").closest("[data-recruit-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
  });
});
