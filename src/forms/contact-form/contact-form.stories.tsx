import type { StoryMeta, Story } from "../../stories/types";
import { ContactForm } from "./contact-form";

const meta: StoryMeta = {
  title: "ContactForm",
  category: "Forms",
  // Real page route (MSW-eligible) demonstrating the interactive
  // input -> confirm -> complete flow with a real (mocked) async submit —
  // the story render() above stays pure/sync. Retargeted from the retired
  // Dialog previewRoute by #235; see packages/ui/STORIES.md §6 (previewRoute
  // escape hatch).
  previewRoute: "/preview/contact",
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
