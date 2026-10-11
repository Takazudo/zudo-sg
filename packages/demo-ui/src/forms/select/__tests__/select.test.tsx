import { renderIsland, renderSsr, getByRole } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Select } from "../select";

const OPTIONS = [
  { value: "product", label: "Product inquiry" },
  { value: "other", label: "Other" },
];

describe("Select", () => {
  it("renders every option", () => {
    const { container } = renderIsland(function Fixture() {
      return <Select name="purpose" options={OPTIONS} aria-label="Purpose" />;
    }, {});
    const select = getByRole(container, "combobox", { name: "Purpose" });
    expect(select.querySelector('option[value="product"]')).toBeInTheDocument();
    expect(select.querySelector('option[value="other"]')).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });
  it("serializes and hydrates a static option selection while leaving later DOM updates writable", async () => {
    const html = renderSsr(<Select options={OPTIONS} value="other" aria-label="Purpose" />);
    const ssr = document.createElement("div");
    ssr.innerHTML = html;
    expect(ssr.querySelector('option[value="other"]')).toHaveAttribute("selected");
    expect(ssr.querySelector("select")!.value).toBe("other");
    expect(ssr.querySelector("select")).not.toHaveAttribute("value");

    const result = renderIsland(function SelectedFixture() {
      return <Select options={OPTIONS} value="other" aria-label="Purpose" />;
    }, {});
    const select = getByRole(result.container, "combobox") as HTMLSelectElement;
    expect(select.value).toBe("other");
    select.value = "product";
    await result.flush();
    expect(select.value).toBe("product");
  });

});
