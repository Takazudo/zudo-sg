import { describe, expect, it } from "vitest";
import { getByText } from "../../../test-utils/zudo-react";
import { renderSsr } from "../../../test-utils/zudo-react";
import { renderStatic } from "../../__tests__/render-static";
import { ProseTable, ProseTh, ProseTd } from "../prose-table";

describe("ProseTable / ProseTh / ProseTd", () => {
  it("renders a table with header and data cells", () => {
    const root = renderStatic(
      <ProseTable>
        <thead>
          <tr>
            <th>Token</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>color-bg</td>
          </tr>
        </tbody>
      </ProseTable>,
    );
    expect(getByText(root, "Token").tagName).toBe("TH");
    expect(getByText(root, "color-bg").tagName).toBe("TD");
    expect(root.querySelector("table > tbody")).not.toBeNull();
  });

  it("applies the border-collapse table styling", () => {
    const root = renderStatic(
      <ProseTable>
        <tbody>
          <tr>
          <td>cell</td>
          </tr>
        </tbody>
      </ProseTable>,
    );
    expect(root.querySelector("table")?.classList.contains("border-collapse")).toBe(true);
  });

  it("keeps the table cell defaults on standalone cell components", () => {
    const header = renderSsr(<ProseTh>Token</ProseTh>);
    const cell = renderSsr(<ProseTd>color-bg</ProseTd>);
    expect(header).toContain("font-semibold text-fg bg-surface");
    expect(header).toContain("overflow-wrap:anywhere");
    expect(cell).toContain("text-left py-vsp-xs px-hsp-md");
    expect(cell).toContain("overflow-wrap:anywhere");
  });
});
