import type { StoryMeta, Story } from "../../stories/types";
import { Callout, Note, type CalloutProps } from "./callout";

const meta: StoryMeta = {
  title: "Callout",
  category: "Feedback",
  description: "Call-out box for notes/asides in body copy, in an accent-tinted or neutral tone.",
  usage: `import { Callout, Note } from "@zudo-sg/ui/src/cards/callout/callout";

<Callout tone="note" title="Note">Body copy.</Callout>
<Note title="Note">Same as tone="note".</Note>`,
};

export default meta;

export const Default: Story<CalloutProps> = {
  name: "Default (tone=note, with title)",
  source: `<Callout title="Note">
  <p>An accent-tinted callout that highlights a note in the flow of body copy.</p>
</Callout>`,
  render: () => (
    <div style={{ maxWidth: "560px" }}>
      <Callout title="Note">
        <p>An accent-tinted callout that highlights a note in the flow of body copy.</p>
      </Callout>
    </div>
  ),
};

export const Tones: Story<CalloutProps> = {
  name: "Tones (note / muted)",
  source: `<Callout tone="note" title="note — accent">…</Callout>
<Callout tone="muted" title="muted — neutral">…</Callout>`,
  render: () => (
    <div class="flex flex-col gap-y-vsp-md" style={{ maxWidth: "560px" }}>
      <Callout tone="note" title="note — accent">
        <p>Content worth drawing attention to, with an accent rule and tint.</p>
      </Callout>
      <Callout tone="muted" title="muted — neutral">
        <p>A neutral aside, shown with a surface tint and a plain border rule.</p>
      </Callout>
    </div>
  ),
};

export const WithoutTitle: Story<CalloutProps> = {
  name: "Without a title",
  source: `<Callout tone="note">
  <p>Body copy only, without a title row.</p>
</Callout>`,
  render: () => (
    <div style={{ maxWidth: "560px" }}>
      <Callout tone="note">
        <p>Body copy only, without a title row.</p>
      </Callout>
    </div>
  ),
};

export const NoteAlias: Story = {
  name: "Note alias",
  source: `<Note title="Note">
  <code>Note</code> is a fixed tone="note" alias of <code>Callout</code>.
</Note>`,
  render: () => (
    <div style={{ maxWidth: "560px" }}>
      <Note title="Note">
        <p>
          <code>Note</code> is a fixed <code>tone="note"</code> alias of <code>Callout</code>.
        </p>
      </Note>
    </div>
  ),
};
