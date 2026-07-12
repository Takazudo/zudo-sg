import type { StoryMeta, Story } from "../../stories/types";
import { ContactForm } from "./contact-form";

const meta: StoryMeta = {
  title: "ContactForm",
  category: "Forms",
  description:
    "Self-contained inquiry form (input -> confirm -> complete). This preview shows the SSR input panel only — the input -> confirm -> complete transitions (and the optional async submit-adapter error path) are driven by the paired ContactFormEnhancer island, which a consuming app mounts separately (see the component's JSDoc). Without it, this is a fully-functional static form whose `<form>` has no `action`.",
  usage: `import { ContactForm } from "@zudo-sg/ui";

<ContactForm />`,
  order: 1,
};

export default meta;

export const Default: Story = {
  name: "Default (input panel)",
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <ContactForm />
    </div>
  ),
};
