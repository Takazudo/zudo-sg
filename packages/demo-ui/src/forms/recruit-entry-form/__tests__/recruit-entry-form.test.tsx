import { renderIsland, getByRole, getByText, fire } from "../../../test-utils/zudo-react";
import { describe, expect, it, vi } from "vitest";
import { RecruitEntryForm } from "../recruit-entry-form";
import RecruitFormEnhancer from "../recruit-form-enhancer";

describe("RecruitEntryForm", () => {
  it("renders the input panel with the category select pre-selected via defaultCategory", () => {
    const { container } = renderIsland(function Fixture() {
      return <RecruitEntryForm defaultCategory="career" />;
    }, {});
    const select = getByRole(container, "combobox", { name: /Recruiting category/ }) as HTMLSelectElement;
    expect(select.value).toBe("career");
  });

  it("keeps confirm/complete panels hidden until enhanced", () => {
    const { container } = renderIsland(function Fixture() {
      return <RecruitEntryForm />;
    }, {});
    expect(getByText(container, "Confirm your entry").closest("[data-recruit-panel]")).toHaveAttribute(
      "hidden",
    );
    expect(
      getByText(container, "Your entry has been received").closest("[data-recruit-panel]"),
    ).toHaveAttribute("hidden");
  });
});

describe("RecruitEntryForm + RecruitFormEnhancer (real ported markup, mounted together)", () => {
  it("advances input -> confirm -> complete (default, no network)", async () => {
    const { container } = renderIsland(function Fixture() {
      return (
        <div>
          <RecruitEntryForm defaultCategory="new-graduate" />
          <RecruitFormEnhancer />
        </div>
      );
    }, {});

    // Targeted by id (not label text) — "Name" and "Name (phonetic)" both start
    // with "Name", so a label-text query would be ambiguous.
    (container.querySelector("#recruit-name") as HTMLInputElement).value = "Ada Lovelace";
    fire(container.querySelector("#recruit-name") as HTMLInputElement, "input");
    (container.querySelector("#recruit-kana") as HTMLInputElement).value = "Ada";
    fire(container.querySelector("#recruit-kana") as HTMLInputElement, "input");
    (container.querySelector("#recruit-email") as HTMLInputElement).value = "ada@example.com";
    fire(container.querySelector("#recruit-email") as HTMLInputElement, "input");
    (container.querySelector("#recruit-phone") as HTMLInputElement).value = "0120000000";
    fire(container.querySelector("#recruit-phone") as HTMLInputElement, "input");

    const category = container.querySelector("#recruit-category") as HTMLSelectElement;
    category.value = "career";
    fire(category, "change");
    fire(container.querySelector("[data-recruit-form-el]") as HTMLFormElement, "submit");
    expect(container.querySelector('[data-recruit-review="category"]')).toHaveTextContent("Career (mid-career)");

    await vi.waitFor(() =>
      expect(getByText(container, "Confirm your entry").closest("[data-recruit-panel]")).not.toHaveAttribute(
        "hidden",
      ),
    );

    fire(getByRole(container, "button", { name: "Submit this entry" }), "click");

    await vi.waitFor(() =>
      expect(
        getByText(container, "Your entry has been received").closest("[data-recruit-panel]"),
      ).not.toHaveAttribute("hidden"),
    );
  });
  it("removes enhancer listeners when its scope is disposed", () => {
    const result = renderIsland(function CleanupFixture() {
      return <div><RecruitEntryForm /><RecruitFormEnhancer /></div>;
    }, {});
    const form = result.container.querySelector("[data-recruit-form-el]")!;
    const confirm = result.container.querySelector('[data-recruit-panel="confirm"]')!;
    result.dispose();
    // Keep the detached DOM reference: an orphaned listener would still cancel
    // this event even after its owning scope disappeared.
    expect(fire(form, "submit", { cancelable: true })).toBe(true);
    expect(confirm).toHaveAttribute("hidden");
  });

});
