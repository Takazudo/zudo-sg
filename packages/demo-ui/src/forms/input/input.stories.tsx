import type { StoryMeta, Story } from "../../stories/types";
import { Input, type InputProps } from "./input";

const meta: StoryMeta = {
  title: "Input",
  category: "Forms",
  description: "Single-line text input control — pairs with Field.",
  usage: `import { Input } from "@zudo-sg/ui";

<Input name="email" type="email" />`,
  order: 2,
};

export default meta;

export const Playground: Story<InputProps> = {
  name: "Playground",
  source: `<Input name="name" />`,
  controls: [
    { type: "select", prop: "type", label: "Type", options: ["text", "email", "tel"], defaultValue: "text" },
    { type: "boolean", prop: "disabled", label: "Disabled", defaultValue: false },
    { type: "boolean", prop: "required", label: "Required", defaultValue: false },
  ],
  render: (args = {}) => (
    <div class="max-w-[24rem]">
      <Input name="name" type={args.type} disabled={args.disabled} required={args.required} />
    </div>
  ),
};
