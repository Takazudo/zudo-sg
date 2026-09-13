import type { StoryMeta, Story } from "../../stories/types";
import { Field } from "./field";
import { Input } from "../input/input";

const meta: StoryMeta = {
  title: "Field",
  category: "Forms",
  description:
    "Labeled form row: label + required/optional badge + optional hint, wrapping a control (Input/Textarea/Select).",
  usage: `import { Field, Input } from "@zudo-sg/ui";

<Field id="name" label="Name" required>
  <Input id="name" name="name" />
</Field>`,
  order: 1,
};

export default meta;

export const Required: Story = {
  name: "Required",
  source: `<Field id="sg-name" label="Name" required>
  <Input id="sg-name" name="name" />
</Field>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Field id="sg-name" label="Name" required>
        <Input id="sg-name" name="name" />
      </Field>
    </div>
  ),
};

export const Optional: Story = {
  name: "Optional, with hint",
  source: `<Field id="sg-company" label="Company / organization" hint="Leave blank for individual inquiries.">
  <Input id="sg-company" name="company" />
</Field>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Field id="sg-company" label="Company / organization" hint="Leave blank for individual inquiries.">
        <Input id="sg-company" name="company" />
      </Field>
    </div>
  ),
};
