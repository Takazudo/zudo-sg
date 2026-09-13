import type { StoryMeta, Story } from "../../stories/types";
import { SubmitButton } from "./submit-button";

const meta: StoryMeta = {
  title: "SubmitButton",
  category: "Forms",
  description: "Accent-filled primary form action. Defaults to type=\"submit\".",
  usage: `import { SubmitButton } from "@zudo-sg/ui";

<SubmitButton>Send</SubmitButton>`,
  order: 5,
};

export default meta;

export const Default: Story = {
  name: "Default",
  source: `<SubmitButton>Review my entry</SubmitButton>`,
  render: () => <SubmitButton>Review my entry</SubmitButton>,
};

export const Disabled: Story = {
  name: "Disabled (busy)",
  source: `<SubmitButton disabled>Sending…</SubmitButton>`,
  render: () => <SubmitButton disabled>Sending…</SubmitButton>,
};
