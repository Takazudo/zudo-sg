import type { StoryMeta, Story } from "../../stories/types";
import { ProseA, type ProseAProps } from "./prose-a";

const meta: StoryMeta = {
  title: "ProseA",
  category: "Typography",
  description: "MDX `a` element override — accent-colored underlined link, unstyled when it's a heading permalink (`class=\"hash-link\"`).",
  usage: `import { ProseA } from "@zudo-sg/ui/src/content/prose-a/prose-a";

<ProseA href="/docs">Read the docs</ProseA>`,
};

export default meta;

export const Default: Story<ProseAProps> = {
  name: "Default",
  source: `<ProseA href="/docs">Read the docs</ProseA>`,
  render: () => <ProseA href="/docs">Read the docs</ProseA>,
};

export const HashLink: Story<ProseAProps> = {
  name: "Hash link (unstyled)",
  source: `<ProseA href="#section" class="hash-link">#</ProseA>`,
  render: () => (
    <ProseA href="#section" class="hash-link">
      #
    </ProseA>
  ),
};
