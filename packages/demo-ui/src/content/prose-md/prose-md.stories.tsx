import type { StoryMeta, Story } from "../../stories/types";
import { ProseMd, type ProseMdProps } from "./prose-md";

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
  usage: `import { ProseMd } from "@zudo-sg/demo-ui/src/content/prose-md/prose-md";

<ProseMd markdown={"## Heading\\n\\nBody copy."} />`,
};

export default meta;

export const Default: Story<ProseMdProps> = {
  name: "Default",
  source: `<ProseMd markdown={${JSON.stringify(SAMPLE_MARKDOWN)}} />`,
  render: () => <ProseMd markdown={SAMPLE_MARKDOWN} />,
};
