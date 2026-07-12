import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { ProseTable, ProseTh, ProseTd } from "../prose-table";

describe("ProseTable / ProseTh / ProseTd", () => {
  it("renders a table with header and data cells", () => {
    render(
      <ProseTable>
        <thead>
          <tr>
            <ProseTh>Token</ProseTh>
          </tr>
        </thead>
        <tbody>
          <tr>
            <ProseTd>color-bg</ProseTd>
          </tr>
        </tbody>
      </ProseTable>,
    );
    expect(screen.getByRole("columnheader", { name: "Token" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "color-bg" })).toBeInTheDocument();
  });

  it("applies the border-collapse table styling", () => {
    render(
      <ProseTable>
        <tbody>
          <tr>
            <ProseTd>cell</ProseTd>
          </tr>
        </tbody>
      </ProseTable>,
    );
    expect(screen.getByRole("table").className).toContain("border-collapse");
  });
});
