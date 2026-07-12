import type { StoryMeta, Story } from "../../stories/types";
import { RecruitEntryForm, type RecruitEntryFormProps } from "./recruit-entry-form";

const meta: StoryMeta = {
  title: "RecruitEntryForm",
  category: "Forms",
  description:
    "Self-contained recruiting entry form (input -> confirm -> complete). This preview shows the SSR input panel only — the transitions are driven by the paired RecruitFormEnhancer island, mounted separately by a consuming app (see the component's JSDoc).",
  usage: `import { RecruitEntryForm } from "@zudo-sg/ui";

<RecruitEntryForm defaultCategory="new-graduate" />`,
  order: 2,
};

export default meta;

export const NewGraduate: Story<RecruitEntryFormProps> = {
  name: "New graduate (default category)",
  source: `<RecruitEntryForm defaultCategory="new-graduate" />`,
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <RecruitEntryForm defaultCategory="new-graduate" />
    </div>
  ),
};

export const Career: Story<RecruitEntryFormProps> = {
  name: "Career (default category)",
  source: `<RecruitEntryForm defaultCategory="career" />`,
  render: () => (
    <div style={{ maxWidth: "760px" }}>
      <RecruitEntryForm defaultCategory="career" />
    </div>
  ),
};
