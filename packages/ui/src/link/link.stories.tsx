import type { StoryMeta, Story } from "../stories/types";
import { Link } from "./link";

const meta: StoryMeta = {
  title: "Link",
  category: "Actions",
  description: "Anchor primitive with default (inline), subtle (nav/meta), and standalone (CTA) variants.",
  usage: `import { Link } from "@zudo-sg/ui";

<Link href="/docs">Read the docs</Link>
<Link href="https://example.com" external>External</Link>`,
  order: 2,
};

export default meta;

export const Variants: Story = {
  name: "Variants",
  source: `<Link href="/docs">inline default link</Link>
<Link href="/about" variant="subtle">Subtle nav link</Link>
<Link href="/start" variant="standalone">Get started</Link>`,
  controls: [
    {
      type: "select",
      prop: "variant",
      label: "Variant",
      options: ["default", "subtle", "standalone"],
      defaultValue: "default",
    },
  ],
  render: () => (
    <p class="flex flex-col gap-vsp-xs text-base text-ink">
      Read the <Link href="/docs">inline default link</Link> in a sentence.
      <Link href="/about" variant="subtle">
        Subtle nav link
      </Link>
      <Link href="/start" variant="standalone">
        Get started
      </Link>
    </p>
  ),
};

export const External: Story = {
  name: "External",
  source: `<Link href="https://example.com" external>external site</Link>`,
  render: () => (
    <p class="text-base text-ink">
      Visit the{" "}
      <Link href="https://example.com" external>
        external site
      </Link>{" "}
      for more.
    </p>
  ),
};
