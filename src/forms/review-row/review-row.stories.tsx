import type { StoryMeta, Story } from "../../stories/types";
import { ReviewRow } from "./review-row";

const meta: StoryMeta = {
  title: "ReviewRow",
  category: "Forms",
  description:
    "One row of a form's confirm panel: a label plus a slot the paired *-form-enhancer fills in with the submitted value.",
  usage: `import { ReviewRow } from "@zudo-sg/ui";

<ReviewRow label="Name" reviewAttr="data-contact-review" field="name" />`,
  order: 7,
};

export default meta;

export const Default: Story = {
  name: "Default",
  source: `<dl>
  <ReviewRow label="Inquiry type" reviewAttr="data-contact-review" field="purpose" />
  <ReviewRow label="Name" reviewAttr="data-contact-review" field="name" />
  <ReviewRow label="Message" reviewAttr="data-contact-review" field="message" multiline />
</dl>`,
  render: () => (
    <dl class="flex max-w-[36rem] flex-col gap-y-vsp-sm">
      <ReviewRow label="Inquiry type" reviewAttr="data-contact-review" field="purpose" />
      <ReviewRow label="Name" reviewAttr="data-contact-review" field="name" />
      <ReviewRow label="Message" reviewAttr="data-contact-review" field="message" multiline />
    </dl>
  ),
};
