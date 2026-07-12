import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { PlaceholderBox, type PlaceholderBoxProps } from "./placeholder-box";

// `PlaceholderBoxProps` carries a `[key: string]: unknown` pass-through index
// signature (for arbitrary MDX `img`-override attributes), which collapses
// `keyof PlaceholderBoxProps` to plain `string` and, with it, every
// `ComposerDefaults`/`ComposerField` prop-keyed lookup to `unknown`/`never`.
// Picking the named props explicitly gives `defineComposer` a finite key
// union to check `defaults`/`fields` against, without touching the real
// component's props (which still accept arbitrary pass-through attributes).
type PlaceholderBoxComposerProps = Pick<
  PlaceholderBoxProps,
  "label" | "alt" | "src" | "aspect" | "size" | "class"
>;

const meta: StoryMeta = {
  title: "PlaceholderBox",
  category: "Media",
  description:
    "Labeled image stand-in used wherever the library has no real asset yet — also serves as the MDX `img` override target.",
  usage: `import { PlaceholderBox } from "@zudo-sg/ui/src/media/placeholder-box/placeholder-box";

<PlaceholderBox label="hero-image.png" aspect="16/9" />`,
  // Leaf: `label` composites with `alt`/`src` fallbacks at render time, and is
  // not a stable single text region across all prop combinations, so it stays
  // inspector-only (no inlineEdit).
  composer: defineComposer<PlaceholderBoxComposerProps>({
    componentId: "ui.placeholder-box",
    version: 1,
    component: PlaceholderBox,
    source: {
      module: "@zudo-sg/ui/src/media/placeholder-box/placeholder-box",
      exportKind: "named",
      exportName: "PlaceholderBox",
    },
    defaults: { label: "hero-image.png", aspect: "16/9", size: "md" },
    fields: [
      { kind: "text", prop: "label", label: "Label" },
      {
        kind: "select",
        prop: "aspect",
        label: "Aspect ratio",
        options: ["16/9", "4/3", "1/1"],
      },
      { kind: "select", prop: "size", label: "Size", options: ["sm", "md", "lg"] },
    ],
  }),
};

export default meta;

export const Default: Story<PlaceholderBoxProps> = {
  name: "Default (size=md, label only)",
  source: `<PlaceholderBox label="hero-image.png" />`,
  render: () => (
    <div style={{ maxWidth: "448px" }}>
      <PlaceholderBox label="hero-image.png" />
    </div>
  ),
};

export const AspectRatios: Story<PlaceholderBoxProps> = {
  name: "Aspect ratios (16:9 / 4:3 / 1:1)",
  source: `<PlaceholderBox label="16 / 9" aspect="16/9" />
<PlaceholderBox label="4 / 3" aspect="4/3" />
<PlaceholderBox label="1 / 1 (square)" aspect="1/1" />`,
  render: () => (
    <div class="grid gap-x-hsp-md gap-y-vsp-sm" style={{ maxWidth: "640px" }}>
      <PlaceholderBox label="16 / 9" aspect="16/9" />
      <PlaceholderBox label="4 / 3" aspect="4/3" />
      <PlaceholderBox label="1 / 1 (square)" aspect="1/1" />
    </div>
  ),
};

export const Sizes: Story<PlaceholderBoxProps> = {
  name: "Size presets (sm / md / lg)",
  source: `<PlaceholderBox label="size = sm" size="sm" />
<PlaceholderBox label="size = md" size="md" />
<PlaceholderBox label="size = lg" size="lg" />`,
  render: () => (
    <div class="flex flex-col gap-y-vsp-sm" style={{ maxWidth: "320px" }}>
      <PlaceholderBox label="size = sm" size="sm" />
      <PlaceholderBox label="size = md" size="md" />
      <PlaceholderBox label="size = lg" size="lg" />
    </div>
  ),
};

export const FromMarkdownImg: Story<PlaceholderBoxProps> = {
  name: "MDX img compatibility",
  source: `{/* alt from ![alt](src) becomes the label */}
<PlaceholderBox alt="Photo of the product" src="/img/product.png" aspect="16/9" />
{/* no alt → src becomes the label */}
<PlaceholderBox src="/img/diagram.svg" aspect="4/3" />
{/* neither → "image" */}
<PlaceholderBox aspect="1/1" />`,
  render: () => (
    <div class="flex flex-col gap-y-vsp-sm" style={{ maxWidth: "480px" }}>
      <PlaceholderBox alt="Photo of the product" src="/img/product.png" aspect="16/9" />
      <PlaceholderBox src="/img/diagram.svg" aspect="4/3" />
      <PlaceholderBox aspect="1/1" />
    </div>
  ),
};
