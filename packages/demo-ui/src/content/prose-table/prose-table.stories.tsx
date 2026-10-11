import type { StoryMeta, Story } from "../../stories/types";
import { ProseTable, type ProseTableProps } from "./prose-table";

const meta: StoryMeta = {
  title: "ProseTable",
  category: "Typography",
  description: "MDX table override with explicit sections and bordered cells.",
  usage: `import { ProseTable } from "@zudo-sg/demo-ui/src/content/prose-table/prose-table";

<ProseTable>
  <thead>
    <tr>
      <th class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Token</th>
      <th class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>color-bg</td>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>white</td>
    </tr>
  </tbody>
</ProseTable>`,
};

export default meta;

export const Default: Story<ProseTableProps> = {
  name: "Default",
  source: `<ProseTable>
  <thead>
    <tr>
      <th class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Token</th>
      <th class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>color-bg</td>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Page background</td>
    </tr>
    <tr>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>color-accent</td>
      <td class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
          style={{ "overflow-wrap": "anywhere" }}>Accent color</td>
    </tr>
  </tbody>
</ProseTable>`,
  render: () => (
    <ProseTable>
      <thead>
        <tr>
          <th
            class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            Token
          </th>
          <th
            class="font-semibold text-fg bg-surface text-left py-vsp-xs px-hsp-md border-b-2 border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            Purpose
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td
            class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            color-bg
          </td>
          <td
            class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            Page background
          </td>
        </tr>
        <tr>
          <td
            class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            color-accent
          </td>
          <td
            class="text-left py-vsp-xs px-hsp-md border-b border-b-border"
            style={{ "overflow-wrap": "anywhere" }}
          >
            Accent color
          </td>
        </tr>
      </tbody>
    </ProseTable>
  ),
};
