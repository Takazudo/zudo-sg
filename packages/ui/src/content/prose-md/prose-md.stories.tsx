import type { StoryMeta, Story } from "../../stories/types";
import { defineComposer } from "../../composer/types";
import { ProseMd, type ProseMdProps } from "./prose-md";

// A small sample INCLUDING a fenced code block, so the Composer default
// demonstrates the runtime's fence highlighting (#371), not just plain prose.
const SAMPLE_MARKDOWN = [
  "## Getting started",
  "",
  "Install the package, then render markdown straight from a string.",
  "",
  "- Zero-config defaults",
  "- Full **TypeScript** support",
  "",
  "```ts",
  "export function greet(name: string): string {",
  "  return `Hello, ${name}!`;",
  "}",
  "```",
  "",
  "> Edits to this field re-render live once wired into the canvas inspector.",
  "",
].join("\n");

const meta: StoryMeta = {
  title: "ProseMd",
  category: "Typography",
  description: "Renders a markdown string client-side (fence highlighting, sanitized output).",
  usage: `import { ProseMd } from "@zudo-sg/ui/src/content/prose-md/prose-md";

<ProseMd markdown={"## Heading\\n\\nBody copy."} />`,
  // Leaf: `markdown` is the single scalar field. The component's rendered
  // root IS the region that shows the rendered/raw content, so the inline
  // editor adapter resolves straight to `root` — same shape as ProseP.
  composer: defineComposer<ProseMdProps>({
    componentId: "ui.prose-md",
    version: 1,
    component: ProseMd,
    source: {
      module: "@zudo-sg/ui/src/content/prose-md/prose-md",
      exportKind: "named",
      exportName: "ProseMd",
    },
    defaults: { markdown: SAMPLE_MARKDOWN },
    fields: [
      {
        kind: "text",
        prop: "markdown",
        label: "Markdown",
        // "markdown-source" (#372): the canvas inline editor shows the raw
        // source as plain text and routes through the explicit-save session
        // (epic #368), not the "plain" auto-commit session.
        inlineEdit: { multiline: true, mode: "markdown-source" },
      },
    ],
    adapters: {
      inlineEditor: { field: "markdown", resolveElement: (root) => root },
    },
  }),
};

export default meta;

export const Default: Story<ProseMdProps> = {
  name: "Default",
  source: `<ProseMd markdown={${JSON.stringify(SAMPLE_MARKDOWN)}} />`,
  render: () => <ProseMd markdown={SAMPLE_MARKDOWN} />,
};
