import type { StoryMeta, Story } from "../../stories/types";
import { SecondaryButton } from "./secondary-button";
import { SubmitButton } from "../submit-button/submit-button";

const meta: StoryMeta = {
  title: "SecondaryButton",
  category: "Forms",
  description: "Outlined secondary form action (e.g. \"Back to edit\") — SubmitButton's sibling.",
  usage: `import { SecondaryButton } from "@zudo-sg/ui";

<SecondaryButton>Back to edit</SecondaryButton>`,
  order: 6,
};

export default meta;

export const Default: Story = {
  name: "Default",
  source: `<SecondaryButton>Back to edit</SecondaryButton>
<SubmitButton type="button">Send this</SubmitButton>`,
  render: () => (
    <div class="flex flex-wrap gap-hsp-md">
      <SecondaryButton>Back to edit</SecondaryButton>
      <SubmitButton type="button">Send this</SubmitButton>
    </div>
  ),
};
