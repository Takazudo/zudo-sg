import type { StoryMeta, Story } from "../../stories/types";
import { Select } from "./select";

const meta: StoryMeta = {
  title: "Select",
  category: "Forms",
  description:
    "Dropdown select with a token-styled arrow (native arrow hidden via appearance-none) — pairs with Field.",
  usage: `import { Select } from "@zudo-sg/ui";

<Select
  name="purpose"
  options={[{ value: "product", label: "Product inquiry" }]}
/>`,
  order: 4,
};

export default meta;

const OPTIONS = [
  { value: "product", label: "Product inquiry" },
  { value: "recruit", label: "Recruiting inquiry" },
  { value: "other", label: "Other" },
];

export const Default: Story = {
  name: "Default",
  source: `<Select name="purpose" options={OPTIONS} />`,
  render: () => (
    <div class="max-w-[24rem]">
      <Select name="purpose" options={OPTIONS} />
    </div>
  ),
};
