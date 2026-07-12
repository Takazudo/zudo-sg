import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { ProseP, type ProsePProps } from "./prose-p";

const meta: StoryMeta = {
  title: "ProseP",
  category: "Typography",
  description: "MDX `p` element override — plain paragraph; flow spacing is owned by the consumer's content-flow stylesheet.",
  usage: `import { ProseP } from "@zudo-sg/ui/src/content/prose-p/prose-p";

<ProseP>Body copy.</ProseP>`,
  // Leaf: `children` is scalar text content (never a nested slot). The
  // rendered root IS the <p> itself, so it's the single reliable text
  // region — the adapter can resolve straight to `root`.
  composer: defineComposer<ProsePProps>({
    componentId: "ui.prose-p",
    version: 1,
    component: ProseP,
    source: {
      module: "@zudo-sg/ui/src/content/prose-p/prose-p",
      exportKind: "named",
      exportName: "ProseP",
    },
    defaults: { children: "Body copy." },
    fields: [
      { kind: "text", prop: "children", label: "Text", inlineEdit: { multiline: true } },
    ],
    adapters: {
      inlineEditor: { field: "children", resolveElement: (root) => root },
    },
  }),
};

export default meta;

export const Default: Story<ProsePProps> = {
  name: "Default",
  source: `<ProseP>Regular body copy, unadorned.</ProseP>`,
  render: () => <ProseP>Regular body copy, unadorned.</ProseP>,
};
