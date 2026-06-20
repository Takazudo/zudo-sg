import type { StoryMeta, Story } from "../stories/types";
import { Field, Input, Textarea } from "./form";
import { Button } from "../button/button";

const meta: StoryMeta = {
  title: "Form",
  category: "Forms",
  description: "Accessible Field wrapper (label + hint/error wiring) with Input and Textarea controls.",
  usage: `import { Field, Input, Textarea, Button } from "@zudo-sg/ui";

<Field label="Email" required>
  {(p) => <Input type="email" {...p} />}
</Field>`,
  order: 1,
};

export default meta;

export const TextField: Story = {
  name: "Text field",
  source: `<Field label="Full name" hint="As it appears on your account.">
  {(p) => <Input placeholder="Ada Lovelace" {...p} />}
</Field>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Field label="Full name" hint="As it appears on your account.">
        {(p) => <Input placeholder="Ada Lovelace" {...p} />}
      </Field>
    </div>
  ),
};

export const Required: Story = {
  name: "Required + error",
  source: `<Field label="Email" required error="Enter a valid email address.">
  {(p) => <Input type="email" defaultValue="not-an-email" invalid {...p} />}
</Field>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Field label="Email" required error="Enter a valid email address.">
        {(p) => <Input type="email" defaultValue="not-an-email" invalid {...p} />}
      </Field>
    </div>
  ),
};

export const Disabled: Story = {
  name: "Disabled",
  source: `<Field label="Account ID">
  {(p) => <Input value="acct_8f3" disabled {...p} />}
</Field>`,
  render: () => (
    <div class="max-w-[24rem]">
      <Field label="Account ID">
        {(p) => <Input value="acct_8f3" disabled {...p} />}
      </Field>
    </div>
  ),
};

export const ContactForm: Story = {
  name: "Contact form",
  source: `<form class="flex max-w-[28rem] flex-col gap-vsp-md" onSubmit={…}>
  <Field label="Name" required>
    {(p) => <Input autoComplete="name" placeholder="Your name" {...p} />}
  </Field>
  <Field label="Email" required>
    {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} />}
  </Field>
  <Field label="Message" hint="Tell us a little about your project.">
    {(p) => <Textarea placeholder="Hello…" {...p} />}
  </Field>
  <Button type="submit">Send message</Button>
</form>`,
  render: () => (
    <form class="flex max-w-[28rem] flex-col gap-vsp-md" onSubmit={(e) => e.preventDefault()}>
      <Field label="Name" required>
        {(p) => <Input autoComplete="name" placeholder="Your name" {...p} />}
      </Field>
      <Field label="Email" required>
        {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} />}
      </Field>
      <Field label="Message" hint="Tell us a little about your project.">
        {(p) => <Textarea placeholder="Hello…" {...p} />}
      </Field>
      <div>
        <Button type="submit">Send message</Button>
      </div>
    </form>
  ),
};
