import type { StoryMeta, Story } from "../../stories/types";
import { ProseTable, ProseTh, ProseTd, type ProseTableProps } from "./prose-table";

const meta: StoryMeta = {
  title: "ProseTable",
  category: "Typography",
  description: "MDX `table`/`th`/`td` element overrides — a compact bordered table.",
  usage: `import { ProseTable, ProseTh, ProseTd } from "@zudo-sg/ui/src/content/prose-table/prose-table";

<ProseTable>
  <thead>
    <tr><ProseTh>Token</ProseTh><ProseTh>Value</ProseTh></tr>
  </thead>
  <tbody>
    <tr><ProseTd>color-bg</ProseTd><ProseTd>white</ProseTd></tr>
  </tbody>
</ProseTable>`,
};

export default meta;

export const Default: Story<ProseTableProps> = {
  name: "Default",
  source: `<ProseTable>
  <thead>
    <tr>
      <ProseTh>Token</ProseTh>
      <ProseTh>Purpose</ProseTh>
    </tr>
  </thead>
  <tbody>
    <tr>
      <ProseTd>color-bg</ProseTd>
      <ProseTd>Page background</ProseTd>
    </tr>
    <tr>
      <ProseTd>color-accent</ProseTd>
      <ProseTd>Accent color</ProseTd>
    </tr>
  </tbody>
</ProseTable>`,
  render: () => (
    <ProseTable>
      <thead>
        <tr>
          <ProseTh>Token</ProseTh>
          <ProseTh>Purpose</ProseTh>
        </tr>
      </thead>
      <tbody>
        <tr>
          <ProseTd>color-bg</ProseTd>
          <ProseTd>Page background</ProseTd>
        </tr>
        <tr>
          <ProseTd>color-accent</ProseTd>
          <ProseTd>Accent color</ProseTd>
        </tr>
      </tbody>
    </ProseTable>
  ),
};
