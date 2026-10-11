import { renderIsland, getByRole } from "../../../test-utils/zudo-react";
import { describe, expect, it } from "vitest";
import { Input } from "../input";

describe("Input", () => {
  it("renders a text input by default", () => {
    const { container } = renderIsland(function Fixture() {
      return <Input name="name" aria-label="Name" />;
    }, {});
    const el = getByRole(container, "textbox", { name: "Name" });
    expect(el).toHaveAttribute("type", "text");
  });

  it("forwards the type prop", () => {
    const { container } = renderIsland(function Fixture() {
      return <Input name="email" type="email" aria-label="Email" />;
    }, {});
    expect(getByRole(container, "textbox", { name: "Email" })).toHaveAttribute("type", "email");
  });
});
