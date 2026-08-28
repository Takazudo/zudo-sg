import type { StoryMeta, Story } from "../../stories/types";
import { Textarea } from "./textarea";

const meta: StoryMeta = {
  title: "Textarea",
  category: "Forms",
  description: "Multi-line text input control (vertical resize only) — pairs with Field.",
  usage: `import { Textarea } from "@zudo-sg/ui";

<Textarea name="message" rows={6} />`,
  order: 3,
};

export default meta;

export const Default: Story = {
  name: "Default",
  source: `<Textarea name="message" rows={6} />`,
  render: () => (
    <div class="max-w-[28rem]">
      <Textarea name="message" rows={6} />
    </div>
  ),
};
